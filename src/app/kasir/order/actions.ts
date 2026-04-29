"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { user as userTable } from "@/db/schema/auth";
import { pelanggan } from "@/db/schema/pelanggan";
import { pengaturan } from "@/db/schema/pengaturan";
import { requireRole } from "@/lib/permissions";
import { sendTelegram, renderTemplate, notifGrupOrder } from "@/lib/telegram";
import { sendWhatsApp } from "@/lib/whatsapp";
import { formatRupiah } from "@/lib/utils";

type Status = "pending" | "diproses" | "diantar" | "selesai" | "batal";

export async function updateOrderStatus(orderId: number, status: Status) {
  const session = await requireRole(["admin", "kasir"]);

  const update: Partial<typeof orderHeader.$inferInsert> = {
    status,
    updatedAt: new Date(),
  };
  // Auto-assign kurir hanya jika belum ada — preserves manual assignment
  if (status === "diproses" || status === "diantar") {
    const current = await db.query.orderHeader.findFirst({
      where: eq(orderHeader.id, orderId),
    });
    if (current && !current.kurirUserId) {
      update.kurirUserId = session.user.id;
    }
  }

  await db.update(orderHeader).set(update).where(eq(orderHeader.id, orderId));

  // Notif grup Telegram per perubahan status
  notifStatusKeGrup(orderId, status, session.user.name).catch(() => {});

  // Notif pelanggan saat order selesai
  if (status === "selesai") {
    notifPelangganOrderSelesai(orderId).catch(() => {});
  }

  revalidatePath("/kasir/order");
  revalidatePath("/admin/order");
  revalidatePath("/pelanggan/beranda");
}

async function notifStatusKeGrup(
  orderId: number,
  status: Status,
  pegawai: string,
): Promise<void> {
  const order = await db.query.orderHeader.findFirst({
    where: eq(orderHeader.id, orderId),
  });
  if (!order) return;

  const pel = order.pelangganId
    ? await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, order.pelangganId) })
    : null;

  const emoji =
    status === "diproses"
      ? "🔧"
      : status === "diantar"
        ? "🚚"
        : status === "selesai"
          ? "✅"
          : status === "batal"
            ? "❌"
            : "🔔";

  const text = [
    `${emoji} *${order.nomorOrder}* — _${status}_`,
    `Pelanggan: ${pel?.nama ?? "-"}`,
    pel?.telp ? `Telp: ${pel.telp}` : null,
    order.alamatAntar ? `Alamat: ${order.alamatAntar}` : null,
    `Total est: ${order.totalEstimasi.toLocaleString("id-ID")}`,
    `Diupdate oleh: ${pegawai}`,
  ]
    .filter(Boolean)
    .join("\n");

  await notifGrupOrder(status, text);
}

async function notifPelangganOrderSelesai(orderId: number) {
  const order = await db.query.orderHeader.findFirst({
    where: eq(orderHeader.id, orderId),
  });
  if (!order || !order.pelangganId) return;

  const pel = await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, order.pelangganId) });
  if (!pel) return;

  const namaDepotRow = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, "namaDepot"),
  });

  const text = await renderTemplate("templateNotifOrderSelesaiPelanggan", {
    nomorOrder: order.nomorOrder,
    total: formatRupiah(order.totalEstimasi),
    namaDepot: namaDepotRow?.value ?? "Depot Air",
  });
  if (!text) return;

  // Telegram
  if (pel.userId) {
    const u = await db.query.user.findFirst({ where: eq(userTable.id, pel.userId) });
    if (u?.telegramChatId) {
      await sendTelegram(u.telegramChatId, text).catch(() => {});
    }
  }
  // WhatsApp
  if (pel.telp) {
    await sendWhatsApp(pel.telp, text).catch(() => {});
  }
}

export async function assignKurir(orderId: number, kurirUserId: string | null) {
  await requireRole(["admin", "kasir"]);
  await db
    .update(orderHeader)
    .set({ kurirUserId, updatedAt: new Date() })
    .where(eq(orderHeader.id, orderId));
  revalidatePath("/kasir/order");
  revalidatePath("/admin/order");
}
