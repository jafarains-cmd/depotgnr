"use server";

import { eq } from "drizzle-orm";
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

// Suppress unused warning kalau pengaturan diakses lewat object
void pengaturan;
