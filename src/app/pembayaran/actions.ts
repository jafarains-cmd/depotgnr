"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { user as userTable } from "@/db/schema/auth";
import { pengaturan } from "@/db/schema/pengaturan";
import { requireRole } from "@/lib/permissions";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendTelegram } from "@/lib/telegram";
import { formatRupiah } from "@/lib/utils";
import { earnFromOrderIfEligible } from "@/lib/loyalty";
import { sendPushToUser } from "@/lib/push";
import { bestEffort } from "@/lib/best-effort";
import { recordKurirBonus } from "@/lib/bonus";
import { syncTransaksiFromOrder } from "@/lib/transaksi-sync";
import { getShiftAktif } from "@/lib/shift";
import { uploadAsset } from "@/lib/drive";

type MetodeOrder = "cash" | "transfer" | "qris" | "dana" | "cod";
const METODE_VALID: MetodeOrder[] = ["cash", "transfer", "qris", "dana", "cod"];

export async function konfirmasiBayar(
  orderId: number,
  opts?: {
    metodeBayarOverride?: string | null;
    catatan?: string | null;
    fotoBase64?: string | null;
    fotoMimeType?: string | null;
  },
): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin", "kasir"]);

  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o) return { error: "Order tidak ditemukan" };
  if (o.statusBayar === "lunas") return { error: "Sudah lunas" };

  // Metode akhir: override kalau valid, kalau tidak pakai existing
  let metodeAkhir: MetodeOrder | null = o.metodeBayar as MetodeOrder | null;
  const override = opts?.metodeBayarOverride?.trim();
  if (override) {
    if (!METODE_VALID.includes(override as MetodeOrder)) {
      return { error: "Metode bayar tidak valid" };
    }
    metodeAkhir = override as MetodeOrder;
  }

  // Upload foto bukti kalau ada (best-effort — tidak block konfirmasi kalau gagal)
  let buktiBayarUrl: string | null = o.buktiBayarUrl;
  if (opts?.fotoBase64 && opts?.fotoMimeType) {
    const up = await uploadAsset({
      prefix: `bukti-bayar-${o.nomorOrder}`,
      base64: opts.fotoBase64,
      mimeType: opts.fotoMimeType,
    });
    if (up.ok && up.url) buktiBayarUrl = up.url;
  }

  // Gabung catatan admin ke catatan order (jangan overwrite catatan lama)
  const now = new Date();
  const catatanAdmin = opts?.catatan?.trim();
  const catatanBaru = catatanAdmin
    ? `${o.catatan ? o.catatan + " · " : ""}[Konfirmasi ${session.user.name}: ${catatanAdmin}]`
    : o.catatan;

  await db
    .update(orderHeader)
    .set({
      statusBayar: "lunas",
      paidPartial: o.totalEstimasi,
      bayarAt: now,
      bayarDikonfirmasiOleh: session.user.id,
      metodeBayar: metodeAkhir,
      buktiBayarUrl,
      catatan: catatanBaru,
      updatedAt: now,
    })
    .where(eq(orderHeader.id, orderId));

  bestEffort("notifLunas", notifLunas(orderId));
  bestEffort("earnFromOrderIfEligible", earnFromOrderIfEligible(orderId));
  bestEffort("recordKurirBonus", recordKurirBonus(orderId));
  const shift = await getShiftAktif(session.user.id);
  bestEffort(
    "syncTransaksiFromOrder",
    syncTransaksiFromOrder(orderId, { overrideShiftId: shift?.id ?? null }),
  );

  revalidatePath("/pembayaran");
  revalidatePath(`/pelanggan/order/${orderId}/bayar`);
  revalidatePath("/pelanggan/riwayat");
  return { ok: true };
}

/**
 * Bayar piutang sebagian (cicilan). Pelanggan bayar X dari total Y.
 * - Kalau jumlahBayar >= sisa piutang → lunas penuh (status=lunas)
 * - Kalau jumlahBayar < sisa → tambah ke paidPartial, status tetap belum
 */
export async function bayarPiutangPartial(args: {
  orderId: number;
  jumlahBayar: number;
  catatan?: string;
  fotoBase64?: string | null;
  fotoMimeType?: string | null;
}): Promise<
  | { ok: true; lunas: boolean; sisaPiutang: number; totalDibayar: number }
  | { error: string }
> {
  const session = await requireRole(["admin", "kasir"]);
  if (!Number.isFinite(args.jumlahBayar) || args.jumlahBayar <= 0) {
    return { error: "Jumlah bayar harus > 0" };
  }
  const o = await db.query.orderHeader.findFirst({
    where: eq(orderHeader.id, args.orderId),
  });
  if (!o) return { error: "Order tidak ditemukan" };
  if (o.statusBayar === "lunas") return { error: "Piutang sudah lunas" };

  const jumlah = Math.floor(args.jumlahBayar);
  const sisaSekarang = o.totalEstimasi - o.paidPartial;
  const dialokasikan = Math.min(jumlah, sisaSekarang);
  const newPaidPartial = o.paidPartial + dialokasikan;
  const lunas = newPaidPartial >= o.totalEstimasi;
  const now = new Date();

  // Upload foto bukti kalau ada (best-effort)
  let buktiBayarUrl: string | null = o.buktiBayarUrl;
  if (args.fotoBase64 && args.fotoMimeType) {
    const up = await uploadAsset({
      prefix: `bukti-cicilan-${o.nomorOrder}`,
      base64: args.fotoBase64,
      mimeType: args.fotoMimeType,
    });
    if (up.ok && up.url) buktiBayarUrl = up.url;
  }

  await db
    .update(orderHeader)
    .set({
      paidPartial: newPaidPartial,
      statusBayar: lunas ? "lunas" : o.statusBayar,
      bayarAt: lunas ? now : o.bayarAt,
      bayarDikonfirmasiOleh: lunas ? session.user.id : o.bayarDikonfirmasiOleh,
      buktiBayarUrl,
      catatan: args.catatan?.trim()
        ? `${o.catatan ? o.catatan + " · " : ""}[Cicilan ${formatRupiah(dialokasikan)} oleh ${session.user.name}${args.catatan ? `: ${args.catatan}` : ""}]`
        : o.catatan,
      updatedAt: now,
    })
    .where(eq(orderHeader.id, args.orderId));

  // Kalau jadi lunas → trigger side-effects sama dengan konfirmasiBayar
  if (lunas) {
    bestEffort("notifLunas(partial)", notifLunas(args.orderId));
    bestEffort("earnFromOrderIfEligible(partial)", earnFromOrderIfEligible(args.orderId));
    bestEffort("recordKurirBonus(partial)", recordKurirBonus(args.orderId));
    const shift = await getShiftAktif(session.user.id);
    bestEffort(
      "syncTransaksiFromOrder(partial)",
      syncTransaksiFromOrder(args.orderId, { overrideShiftId: shift?.id ?? null }),
    );
  }

  revalidatePath("/pembayaran");
  revalidatePath(`/pelanggan/order/${args.orderId}/bayar`);
  revalidatePath("/pelanggan/riwayat");
  return {
    ok: true,
    lunas,
    sisaPiutang: Math.max(0, o.totalEstimasi - newPaidPartial),
    totalDibayar: dialokasikan,
  };
}

export async function tolakBayar(
  orderId: number,
  alasan: string,
): Promise<{ ok: true } | { error: string }> {
  await requireRole(["admin", "kasir"]);

  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o) return { error: "Order tidak ditemukan" };
  if (o.statusBayar !== "menunggu") {
    return { error: "Hanya bisa tolak bukti yang sedang menunggu verifikasi" };
  }

  await db
    .update(orderHeader)
    .set({
      statusBayar: "belum",
      buktiBayarUrl: null,
      updatedAt: new Date(),
    })
    .where(eq(orderHeader.id, orderId));

  bestEffort("notifTolak", notifTolak(orderId, alasan));

  revalidatePath("/pembayaran");
  return { ok: true };
}

async function notifLunas(orderId: number) {
  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o || !o.pelangganId) return;
  const pel = await db.query.pelanggan.findFirst({
    where: eq(pelangganTable.id, o.pelangganId),
  });
  if (!pel) return;

  const namaDepot = (await db.query.pengaturan.findFirst({ where: eq(pengaturan.key, "namaDepot") }))?.value ?? "Depot Air";

  const text = [
    `✅ Pembayaran *${o.nomorOrder}* sudah dikonfirmasi`,
    `Total: ${formatRupiah(o.totalEstimasi)}`,
    `Metode: ${(o.metodeBayar ?? "-").toUpperCase()}`,
    ``,
    `Terima kasih, ${namaDepot} akan segera proses pesanan Anda.`,
  ].join("\n");

  if (pel.telp) await sendWhatsApp(pel.telp, text).catch(() => {});

  if (pel.userId) {
    const u = await db.query.user.findFirst({ where: eq(userTable.id, pel.userId) });
    if (u?.telegramChatId) await sendTelegram(u.telegramChatId, text).catch(() => {});
    sendPushToUser(pel.userId, {
      title: "✅ Pembayaran Dikonfirmasi",
      body: `${o.nomorOrder} sudah lunas. Order akan segera diproses.`,
      url: "/pelanggan/riwayat",
      tag: `pay-${o.nomorOrder}`,
    }).catch(() => {});
  }
}

async function notifTolak(orderId: number, alasan: string) {
  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o || !o.pelangganId) return;
  const pel = await db.query.pelanggan.findFirst({
    where: eq(pelangganTable.id, o.pelangganId),
  });
  if (!pel) return;

  const text = [
    `⚠️ Bukti pembayaran *${o.nomorOrder}* belum bisa kami konfirmasi`,
    `Alasan: ${alasan || "tidak ditemukan di mutasi kami"}`,
    ``,
    `Silakan cek kembali atau hubungi admin. Anda bisa upload ulang bukti dari halaman riwayat order.`,
  ].join("\n");

  if (pel.telp) await sendWhatsApp(pel.telp, text).catch(() => {});

  if (pel.userId) {
    const u = await db.query.user.findFirst({ where: eq(userTable.id, pel.userId) });
    if (u?.telegramChatId) await sendTelegram(u.telegramChatId, text).catch(() => {});
  }
}
