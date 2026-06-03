"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { transaksi, transaksiItem } from "@/db/schema/transaksi";
import { produk } from "@/db/schema/produk";
import { pelanggan } from "@/db/schema/pelanggan";
import { user as userTable } from "@/db/schema/auth";
import { pengaturan } from "@/db/schema/pengaturan";
import { requireRole } from "@/lib/permissions";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendTelegram } from "@/lib/telegram";
import { formatRupiah } from "@/lib/utils";
import { reverseLoyaltyForTransaksi, reverseLoyaltyForOrder } from "@/lib/loyalty";
import { reverseStokForTransaksi, reverseStokForOrder } from "@/lib/inventory";
import { reverseBonusForOrder } from "@/lib/bonus";
import { orderHeader } from "@/db/schema/order";
import { bestEffort } from "@/lib/best-effort";

async function buildNotaText(trxId: number): Promise<string | null> {
  const t = await db.query.transaksi.findFirst({ where: eq(transaksi.id, trxId) });
  if (!t) return null;

  const items = await db
    .select({
      qty: transaksiItem.qty,
      hargaSatuan: transaksiItem.hargaSatuan,
      subtotal: transaksiItem.subtotal,
      jenis: transaksiItem.jenis,
      namaProduk: produk.nama,
    })
    .from(transaksiItem)
    .leftJoin(produk, eq(transaksiItem.produkId, produk.id))
    .where(eq(transaksiItem.transaksiId, trxId));

  const cfgRows = await db.query.pengaturan.findMany();
  const cfg = Object.fromEntries(cfgRows.map((r) => [r.key, r.value ?? ""]));

  const namaDepot = cfg.namaDepot || "Depot Air Minum";
  const lines = [
    `*${namaDepot}*`,
    `Nota: \`${t.nomorNota}\``,
    `${t.createdAt.toLocaleString("id-ID")}`,
    "",
    ...items.map(
      (it) =>
        `• ${it.qty}× ${it.namaProduk} (${it.jenis})\n  ${formatRupiah(it.hargaSatuan)} = ${formatRupiah(it.subtotal)}`,
    ),
    "",
    `Subtotal: ${formatRupiah(t.subtotal)}`,
    ...(t.diskon > 0 ? [`Diskon: -${formatRupiah(t.diskon)}`] : []),
    `*Total: ${formatRupiah(t.total)}*`,
    `Bayar: ${t.metodeBayar.toUpperCase()}`,
    "",
    "Terima kasih 🙏",
  ];
  return lines.join("\n");
}

export async function kirimNotaWA(
  trxId: number,
  nomor: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole(["admin", "kasir"]);
  const text = await buildNotaText(trxId);
  if (!text) return { ok: false, error: "Transaksi tidak ditemukan" };
  if (!nomor.trim()) return { ok: false, error: "Nomor WA kosong" };
  try {
    await sendWhatsApp(nomor, text);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal" };
  }
}

export async function kirimNotaTelegramKePelanggan(
  trxId: number,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole(["admin", "kasir"]);
  const t = await db.query.transaksi.findFirst({ where: eq(transaksi.id, trxId) });
  if (!t || !t.pelangganId) return { ok: false, error: "Transaksi tanpa pelanggan" };

  const pel = await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, t.pelangganId) });
  if (!pel?.userId) return { ok: false, error: "Pelanggan belum punya akun login" };

  const u = await db.query.user.findFirst({ where: eq(userTable.id, pel.userId) });
  if (!u?.telegramChatId) return { ok: false, error: "Pelanggan belum hubungkan Telegram" };

  const text = await buildNotaText(trxId);
  if (!text) return { ok: false, error: "Gagal compose nota" };

  try {
    await sendTelegram(u.telegramChatId, text);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal" };
  }
}

export async function getNotaText(trxId: number): Promise<string> {
  await requireRole(["admin", "kasir"]);
  return (await buildNotaText(trxId)) ?? "";
}

const VOID_WINDOW_DAYS = 30;

/**
 * Batalkan transaksi (admin only). Hanya untuk transaksi yang dibuat dalam
 * 30 hari terakhir. Reverse loyalty + stok, set voidedAt/voidedBy/voidedAlasan.
 */
export async function batalkanTransaksi(
  trxId: number,
  alasan: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin"]);
  const reason = alasan.trim();
  if (reason.length < 3) return { error: "Alasan wajib diisi (min 3 karakter)" };
  if (reason.length > 500) return { error: "Alasan terlalu panjang (max 500 karakter)" };

  const t = await db.query.transaksi.findFirst({ where: eq(transaksi.id, trxId) });
  if (!t) return { error: "Transaksi tidak ditemukan" };
  if (t.voidedAt) return { error: "Transaksi ini sudah dibatalkan sebelumnya" };

  const ageMs = Date.now() - t.createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays > VOID_WINDOW_DAYS) {
    return { error: `Transaksi sudah > ${VOID_WINDOW_DAYS} hari, tidak bisa dibatalkan` };
  }

  await db
    .update(transaksi)
    .set({
      voidedAt: new Date(),
      voidedBy: session.user.id,
      voidedAlasan: reason,
    })
    .where(eq(transaksi.id, trxId));

  bestEffort("reverseLoyaltyForTransaksi", reverseLoyaltyForTransaksi(trxId));
  bestEffort("reverseStokForTransaksi", reverseStokForTransaksi(trxId, session.user.id));

  // Kalau transaksi auto-sync dari order, balikkan juga order asalnya supaya
  // tidak inkonsisten: order tampil "selesai+lunas" padahal transaksi voided.
  if (t.refOrderId) {
    await db
      .update(orderHeader)
      .set({ status: "batal", updatedAt: new Date() })
      .where(eq(orderHeader.id, t.refOrderId));
    bestEffort("reverseLoyaltyForOrder", reverseLoyaltyForOrder(t.refOrderId));
    bestEffort("reverseBonusForOrder", reverseBonusForOrder(t.refOrderId).then(() => {}));
    bestEffort("reverseStokForOrder", reverseStokForOrder(t.refOrderId, session.user.id));
    revalidatePath("/kasir/order");
    revalidatePath("/admin/order");
  }

  revalidatePath("/kasir/transaksi");
  revalidatePath(`/kasir/transaksi/${trxId}`);
  revalidatePath("/admin/laporan");
  revalidatePath("/admin/dashboard");

  return { ok: true };
}

/**
 * Batalkan transaksi via orderId (shortcut dari halaman order). Cari
 * transaksi yang ter-sync dari order tersebut, lalu panggil batalkanTransaksi.
 * Admin only, 30-hari window sama dengan batalkanTransaksi.
 */
export async function batalkanOrderTuntas(
  orderId: number,
  alasan: string,
): Promise<{ ok: true } | { error: string }> {
  await requireRole(["admin"]);
  const t = await db.query.transaksi.findFirst({
    where: eq(transaksi.refOrderId, orderId),
  });
  if (!t) return { error: "Order ini belum punya transaksi ter-sync — batalkan dari halaman order biasa" };
  return batalkanTransaksi(t.id, alasan);
}

// Suppress unused warning kalau pengaturan diakses lewat object
void pengaturan;
