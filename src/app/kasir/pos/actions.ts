"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { transaksi, transaksiItem } from "@/db/schema/transaksi";
import { stokGalon, mutasiStok } from "@/db/schema/inventory";
import { orderHeader, orderItem } from "@/db/schema/order";
import { generateTrackingToken } from "@/lib/tracking";
import { requireRole } from "@/lib/permissions";
import { generateNomorNota } from "@/lib/utils";
import { notifAdminTelegram, notifGrupOrder } from "@/lib/telegram";
import { sendWhatsAppGroup } from "@/lib/whatsapp";
import { pengaturan as pengaturanTable } from "@/db/schema/pengaturan";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { pushTransaksi, pushOrder } from "@/lib/sheets";
import {
  earnLoyalty,
  redeemLoyalty,
  claimReferralBonusIfFirstOrder,
  getLoyaltyConfig,
} from "@/lib/loyalty";
import { bestEffort } from "@/lib/best-effort";

type Jenis = "isi_ulang" | "tukar" | "beli_baru";

export type CartItem = {
  produkId: number;
  qty: number;
  hargaSatuan: number;
  jenis: Jenis;
};

export type CreateTransaksiInput = {
  pelangganId: number | null;
  items: CartItem[];
  diskon: number;
  metodeBayar: "cash" | "transfer" | "qris" | "piutang";
  pengantaran?: "pickup" | "antar";
  alamatAntar?: string;
  jadwalAntar?: string;
  catatan?: string;
  refOrderId?: number;
  redeemLoyalti?: number; // saldo yang dipakai oleh pelanggan
};

export async function createTransaksi(input: CreateTransaksiInput) {
  const session = await requireRole(["admin", "kasir"]);

  if (input.items.length === 0) throw new Error("Tidak ada item");

  const subtotal = input.items.reduce((s, it) => s + it.hargaSatuan * it.qty, 0);
  const redeem = Math.max(0, Math.min(input.redeemLoyalti ?? 0, subtotal - (input.diskon ?? 0)));
  const total = Math.max(0, subtotal - (input.diskon ?? 0) - redeem);

  const pengantaran = input.pengantaran ?? "pickup";
  const isPiutang = input.metodeBayar === "piutang";
  const isPayOnline = input.metodeBayar === "transfer" || input.metodeBayar === "qris";

  // Validasi awal
  if (isPiutang && !input.pelangganId) {
    throw new Error("Bayar nanti (piutang) wajib pilih pelanggan terdaftar");
  }
  if (pengantaran === "antar" && !input.alamatAntar?.trim()) {
    throw new Error("Antar ke alamat: isi alamat dulu");
  }
  if (isPayOnline && !input.pelangganId) {
    throw new Error(
      "Bayar transfer/QRIS butuh pelanggan terdaftar (untuk upload bukti bayar). Pilih pelanggan dulu, atau pakai metode CASH.",
    );
  }

  // Routing:
  //   antar (apapun bayarnya)             → order delivery
  //   pickup + transfer/qris              → order POS upload bukti (existing)
  //   pickup + piutang                    → order POS langsung selesai, statusBayar=belum
  //   pickup + cash                       → transaksi lunas (existing)
  if (pengantaran === "antar") {
    return createOrderAntar({ session, input, total });
  }
  if (isPayOnline) {
    return createOrderUntukBayarOnline({ session, input, total, subtotal });
  }
  if (isPiutang) {
    return createOrderPickupPiutang({ session, input, total });
  }

  // === Cash flow (existing) ===
  const nomorNota = generateNomorNota("NOTA");

  // Validate redeem (kalau ada) sebelum insert
  if (redeem > 0) {
    if (!input.pelangganId) throw new Error("Redeem loyalty butuh pelanggan terdaftar");
    const r = await redeemLoyalty({
      pelangganId: input.pelangganId,
      jumlah: redeem,
      deskripsi: `Redeem di POS ${nomorNota}`,
    });
    if (!r.ok) throw new Error(r.error);
  }

  const trxId = await db.transaction((tx) => {
    const [trx] = tx
      .insert(transaksi)
      .values({
        nomorNota,
        kasirUserId: session.user.id,
        pelangganId: input.pelangganId,
        subtotal,
        diskon: input.diskon ?? 0,
        total,
        metodeBayar: "cash",
        status: "lunas",
        catatan: input.catatan ?? null,
        refOrderId: input.refOrderId ?? null,
      })
      .returning()
      .all();

    for (const it of input.items) {
      tx.insert(transaksiItem)
        .values({
          transaksiId: trx.id,
          produkId: it.produkId,
          qty: it.qty,
          hargaSatuan: it.hargaSatuan,
          subtotal: it.hargaSatuan * it.qty,
          jenis: it.jenis,
        })
        .run();

      // Update stok + log mutasi
      // Aturan stok:
      //   isi_ulang : stok terisi -qty (galon pelanggan diisi & dikembalikan, depot kehilangan air)
      //               → kita anggap depot punya pool "air siap" = stok terisi.
      //   tukar     : stok terisi -qty, stok kosong +qty (pelanggan kasih kosong, terima terisi)
      //   beli_baru : stok terisi -qty (galon ikut dibawa pelanggan)
      adjustStok(tx, it.produkId, "terisi", -it.qty, it.jenis, trx.id, null, session.user.id);
      if (it.jenis === "tukar") {
        adjustStok(tx, it.produkId, "kosong", +it.qty, it.jenis, trx.id, null, session.user.id);
      }
    }

    // Jika dari order, tandai order selesai + link transaksi
    if (input.refOrderId) {
      tx.update(orderHeader)
        .set({ status: "selesai", transaksiId: trx.id, updatedAt: new Date() })
        .where(eq(orderHeader.id, input.refOrderId))
        .run();
    }

    return trx.id;
  });

  // Notifikasi admin (best-effort)
  bestEffort(
    "notifAdminTelegram(transaksi)",
    notifAdminTelegram(
      `🧾 Transaksi *${nomorNota}*\nTotal: ${total.toLocaleString("id-ID")}\nKasir: ${session.user.name}`,
    ),
  );

  // Earn loyalty (best-effort) — rate baca dari pengaturan, fallback default
  if (input.pelangganId) {
    const totalGalon = input.items.reduce((s, it) => s + it.qty, 0);
    const cfg = await getLoyaltyConfig();
    const rate = input.refOrderId ? cfg.ratePerGalonAntar : cfg.ratePerGalonDepot;
    bestEffort(
      `earnLoyalty(${nomorNota})`,
      earnLoyalty({
        pelangganId: input.pelangganId,
        jumlahGalon: totalGalon,
        rate,
        refTransaksiId: trxId,
        refOrderId: input.refOrderId,
        deskripsi: `Earn dari ${nomorNota} (${totalGalon} galon × Rp ${rate.toLocaleString("id-ID")})`,
      }),
    );
    bestEffort(
      `claimReferralBonus(${nomorNota})`,
      claimReferralBonusIfFirstOrder(input.pelangganId, input.refOrderId, trxId),
    );
  }

  // Push ke Sheets (best-effort)
  pushTransaksi(trxId).catch((e) => console.warn("[sheets] pushTransaksi:", e));

  revalidatePath("/kasir/pos");
  revalidatePath("/kasir/transaksi");
  revalidatePath("/admin/transaksi");
  revalidatePath("/admin/dashboard");

  return { type: "transaksi" as const, id: trxId as number, nomorNota, total };
}

/**
 * POS dengan metode transfer/QRIS — buat order walk-in yang menunggu pelanggan upload bukti.
 * Stok tetap turun langsung (barang sudah diambil pelanggan).
 * Pelanggan bisa lanjut bayar di /pelanggan/order/[id]/bayar.
 */
async function createOrderUntukBayarOnline(args: {
  session: Awaited<ReturnType<typeof requireRole>>;
  input: CreateTransaksiInput;
  total: number;
  subtotal: number;
}): Promise<{
  type: "order";
  orderId: number;
  nomorOrder: string;
  total: number;
  payUrl: string;
}> {
  const { session, input, total } = args;
  const nomorOrder = generateNomorNota("POS");

  const orderId = db.transaction((tx) => {
    const [o] = tx
      .insert(orderHeader)
      .values({
        nomorOrder,
        pelangganId: input.pelangganId,
        sumber: "walk-in",
        alamatAntar: "(diambil di depot)",
        status: "selesai", // Barang sudah diambil pelanggan
        diantarAt: new Date(),
        tipePengantaran: "antar-saja",
        totalEstimasi: total,
        catatan: input.catatan ?? null,
        metodeBayar: input.metodeBayar as "transfer" | "qris",
        statusBayar: "belum",
        trackingToken: generateTrackingToken(),
        kurirUserId: session.user.id, // catat siapa kasir yang handle
      })
      .returning()
      .all();

    for (const it of input.items) {
      tx.insert(orderItem)
        .values({
          orderId: o.id,
          produkId: it.produkId,
          qty: it.qty,
          jenis: it.jenis,
          hargaEstimasi: it.hargaSatuan,
        })
        .run();

      // Stok turun langsung (barang sudah diambil)
      adjustStok(tx, it.produkId, "terisi", -it.qty, it.jenis, null, o.id, session.user.id);
      if (it.jenis === "tukar") {
        adjustStok(tx, it.produkId, "kosong", +it.qty, it.jenis, null, o.id, session.user.id);
      }
    }

    return o.id;
  });

  bestEffort(
    "notifAdminTelegram(pos-online)",
    notifAdminTelegram(
      `🧾 *${nomorOrder}* (POS · ${(input.metodeBayar ?? "").toUpperCase()})\nTotal: ${total.toLocaleString("id-ID")}\nKasir: ${session.user.name}\nMenunggu pelanggan upload bukti bayar.`,
    ),
  );

  revalidatePath("/kasir/pos");
  revalidatePath("/pembayaran");

  return {
    type: "order",
    orderId,
    nomorOrder,
    total,
    payUrl: `/pelanggan/order/${orderId}/bayar`,
  };
}

/**
 * POS pickup + bayar nanti (piutang). Pelanggan ambil galon langsung di depot
 * dan janji bayar nanti. Tidak ada bonus kurir (alamat=depot). Stok turun.
 */
async function createOrderPickupPiutang(args: {
  session: Awaited<ReturnType<typeof requireRole>>;
  input: CreateTransaksiInput;
  total: number;
}): Promise<{
  type: "order";
  orderId: number;
  nomorOrder: string;
  total: number;
  payUrl: string;
}> {
  const { session, input, total } = args;
  const nomorOrder = generateNomorNota("POS");

  const orderId = db.transaction((tx) => {
    const [o] = tx
      .insert(orderHeader)
      .values({
        nomorOrder,
        pelangganId: input.pelangganId,
        sumber: "walk-in",
        alamatAntar: "(diambil di depot)",
        status: "selesai",
        diantarAt: new Date(),
        selesaiAt: new Date(),
        tipePengantaran: "antar-saja",
        totalEstimasi: total,
        catatan: input.catatan ?? null,
        statusBayar: "belum",
        trackingToken: generateTrackingToken(),
        kurirUserId: session.user.id,
      })
      .returning()
      .all();

    for (const it of input.items) {
      tx.insert(orderItem)
        .values({
          orderId: o.id,
          produkId: it.produkId,
          qty: it.qty,
          jenis: it.jenis,
          hargaEstimasi: it.hargaSatuan,
        })
        .run();

      adjustStok(tx, it.produkId, "terisi", -it.qty, it.jenis, null, o.id, session.user.id);
      if (it.jenis === "tukar") {
        adjustStok(tx, it.produkId, "kosong", +it.qty, it.jenis, null, o.id, session.user.id);
      }
    }

    return o.id;
  });

  const pelNama = await getPelangganNama(input.pelangganId);
  const notifText = [
    `📒 *${nomorOrder}* (POS · PIUTANG)`,
    `Pelanggan: ${pelNama}`,
    `Total: ${total.toLocaleString("id-ID")}`,
    `Bayar nanti — tunggu pelanggan lunasi.`,
    `Kasir: ${session.user.name}`,
  ].join("\n");
  bestEffort("notifAdminTelegram(pos-piutang)", notifAdminTelegram(notifText));
  bestEffort("notifGrupOrder(pos-piutang)", notifGrupOrder("pending", notifText));
  bestEffort("notifWaGroup(pos-piutang)", notifWaGroupOrder(notifText));

  revalidatePath("/kasir/pos");
  revalidatePath("/pembayaran");
  revalidatePath("/admin/transaksi");
  revalidatePath("/admin/dashboard");

  return {
    type: "order",
    orderId,
    nomorOrder,
    total,
    payUrl: `/pelanggan/order/${orderId}/bayar`,
  };
}

/**
 * POS dengan pengantaran antar — kasir buat order, kurir akan antar.
 * Stok tetap turun langsung (galon disiapkan untuk diantar).
 * - cash: statusBayar=lunas (pelanggan bayar di depot sebelum antar)
 * - transfer/qris: statusBayar=belum (pelanggan upload bukti)
 * - piutang: statusBayar=belum (bayar saat barang sampai / nanti)
 */
async function createOrderAntar(args: {
  session: Awaited<ReturnType<typeof requireRole>>;
  input: CreateTransaksiInput;
  total: number;
}): Promise<{
  type: "order";
  orderId: number;
  nomorOrder: string;
  total: number;
  payUrl: string;
}> {
  const { session, input, total } = args;
  const nomorOrder = generateNomorNota("ORD");
  const isPiutang = input.metodeBayar === "piutang";
  const isCash = input.metodeBayar === "cash";
  const isOnline = input.metodeBayar === "transfer" || input.metodeBayar === "qris";

  const orderId = db.transaction((tx) => {
    const [o] = tx
      .insert(orderHeader)
      .values({
        nomorOrder,
        pelangganId: input.pelangganId,
        sumber: "walk-in",
        alamatAntar: input.alamatAntar!,
        jadwalAntar: input.jadwalAntar ? new Date(input.jadwalAntar) : null,
        status: "pending",
        tipePengantaran: "antar-saja",
        totalEstimasi: total,
        catatan: input.catatan ?? null,
        metodeBayar: isOnline
          ? (input.metodeBayar as "transfer" | "qris")
          : isCash
            ? "cash"
            : null,
        statusBayar: isCash ? "lunas" : "belum",
        bayarAt: isCash ? new Date() : null,
        bayarDikonfirmasiOleh: isCash ? session.user.id : null,
        trackingToken: generateTrackingToken(),
      })
      .returning()
      .all();

    for (const it of input.items) {
      tx.insert(orderItem)
        .values({
          orderId: o.id,
          produkId: it.produkId,
          qty: it.qty,
          jenis: it.jenis,
          hargaEstimasi: it.hargaSatuan,
        })
        .run();
    }

    return o.id;
  });

  pushOrder(orderId).catch(() => {});

  const pelNama = await getPelangganNama(input.pelangganId);
  const badge = isPiutang
    ? "PIUTANG"
    : isCash
      ? "CASH-LUNAS"
      : (input.metodeBayar ?? "").toUpperCase();
  const notifText = [
    `🆕 *${nomorOrder}* (POS antar · ${badge})`,
    `Pelanggan: ${pelNama}`,
    `Total est: ${total.toLocaleString("id-ID")}`,
    input.alamatAntar ? `Alamat: ${input.alamatAntar}` : "",
    `Kasir: ${session.user.name}`,
  ]
    .filter(Boolean)
    .join("\n");
  bestEffort("notifGrupOrder(pos-antar)", notifGrupOrder("pending", notifText));
  bestEffort("notifWaGroup(pos-antar)", notifWaGroupOrder(notifText));

  revalidatePath("/kasir/pos");
  revalidatePath("/kasir/order");
  revalidatePath("/admin/order");
  revalidatePath("/pembayaran");

  return {
    type: "order",
    orderId,
    nomorOrder,
    total,
    payUrl: isOnline ? `/pelanggan/order/${orderId}/bayar` : `/admin/order`,
  };
}

async function getPelangganNama(pelangganId: number | null): Promise<string> {
  if (!pelangganId) return "Walk-in";
  const p = await db.query.pelanggan.findFirst({
    where: eq(pelangganTable.id, pelangganId),
  });
  return p?.nama ?? "Walk-in";
}

async function notifWaGroupOrder(text: string) {
  const row = await db.query.pengaturan.findFirst({
    where: eq(pengaturanTable.key, "waGroupOrderMasuk"),
  });
  const groupId = row?.value?.trim();
  if (groupId) await sendWhatsAppGroup(groupId, text);
}

function adjustStok(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  produkId: number,
  status: "kosong" | "terisi" | "rusak",
  delta: number,
  alasanJenis: Jenis,
  refTrxId: number | null,
  refOrderId: number | null,
  userId: string,
) {
  const existing = tx
    .select()
    .from(stokGalon)
    .where(and(eq(stokGalon.produkId, produkId), eq(stokGalon.status, status)))
    .all();
  const row = existing[0];
  if (row) {
    tx.update(stokGalon)
      .set({ jumlah: Math.max(0, row.jumlah + delta), updatedAt: new Date() })
      .where(eq(stokGalon.id, row.id))
      .run();
  } else {
    tx.insert(stokGalon)
      .values({ produkId, status, jumlah: Math.max(0, delta) })
      .run();
  }
  tx.insert(mutasiStok)
    .values({
      produkId,
      status,
      perubahan: delta,
      alasan: refOrderId ? `pos-online:${alasanJenis}` : `transaksi:${alasanJenis}`,
      refTransaksiId: refTrxId,
      refOrderId,
      userId,
    })
    .run();
}
