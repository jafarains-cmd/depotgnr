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

export async function konfirmasiBayar(
  orderId: number,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin", "kasir"]);

  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o) return { error: "Order tidak ditemukan" };
  if (o.statusBayar === "lunas") return { error: "Sudah lunas" };

  await db
    .update(orderHeader)
    .set({
      statusBayar: "lunas",
      bayarAt: new Date(),
      bayarDikonfirmasiOleh: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(orderHeader.id, orderId));

  bestEffort("notifLunas", notifLunas(orderId));
  bestEffort("earnFromOrderIfEligible", earnFromOrderIfEligible(orderId));
  // Catat bonus kurir kalau order sudah selesai (recordKurirBonus idempoten + cek selesai+lunas)
  bestEffort("recordKurirBonus", recordKurirBonus(orderId));
  // Sync ke tabel transaksi supaya muncul di laporan/dashboard omzet
  bestEffort("syncTransaksiFromOrder", syncTransaksiFromOrder(orderId));

  revalidatePath("/pembayaran");
  revalidatePath(`/pelanggan/order/${orderId}/bayar`);
  revalidatePath("/pelanggan/riwayat");
  return { ok: true };
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
