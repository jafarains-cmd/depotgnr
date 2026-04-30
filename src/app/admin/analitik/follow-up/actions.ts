"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { user as userTable } from "@/db/schema/auth";
import { pengaturan } from "@/db/schema/pengaturan";
import { requireRole } from "@/lib/permissions";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendTelegram } from "@/lib/telegram";
import { sendPushToUser } from "@/lib/push";

export async function kirimReminder(
  pelangganId: number,
): Promise<{ ok: true } | { error: string }> {
  await requireRole(["admin", "kasir"]);

  const p = await db.query.pelanggan.findFirst({
    where: eq(pelangganTable.id, pelangganId),
  });
  if (!p) return { error: "Pelanggan tidak ditemukan" };

  const namaDepotRow = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, "namaDepot"),
  });
  const namaDepot = namaDepotRow?.value ?? "Depot Air";

  const text =
    `Halo ${p.nama}! 💧\n` +
    `Galon Anda mungkin sudah mau habis ya?\n` +
    `Yuk order isi ulang lagi dari ${namaDepot} — kami antar cepat ke rumah.\n\n` +
    `Order langsung: https://depot.genster.my.id/pelanggan/order-baru`;

  const channels: string[] = [];

  if (p.telp) {
    try {
      await sendWhatsApp(p.telp, text);
      channels.push("WA");
    } catch {
      // ignore
    }
  }
  if (p.userId) {
    const u = await db.query.user.findFirst({ where: eq(userTable.id, p.userId) });
    if (u?.telegramChatId) {
      await sendTelegram(u.telegramChatId, text).catch(() => {});
      channels.push("Telegram");
    }
    sendPushToUser(p.userId, {
      title: "💧 Waktunya Order Lagi",
      body: `Halo ${p.nama}, galon Anda mungkin sudah mau habis. Order sekarang yuk!`,
      url: "/pelanggan/order-baru",
      tag: "reminder-order",
    }).catch(() => {});
    channels.push("Push");
  }

  if (channels.length === 0) {
    return { error: "Tidak ada channel notif yang tersedia (telp/Telegram/push)" };
  }

  return { ok: true };
}

export async function kirimReminderMassal(
  pelangganIds: number[],
): Promise<{ sent: number; failed: number }> {
  await requireRole(["admin", "kasir"]);
  let sent = 0;
  let failed = 0;
  for (const id of pelangganIds) {
    const r = await kirimReminder(id);
    if ("ok" in r) sent++;
    else failed++;
    // Rate-limit: jeda 500ms biar gak burst ke WA gateway
    await new Promise((res) => setTimeout(res, 500));
  }
  return { sent, failed };
}
