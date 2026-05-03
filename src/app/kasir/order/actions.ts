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
import { earnFromOrderIfEligible, reverseLoyaltyForOrder } from "@/lib/loyalty";
import { reverseBonusForOrder } from "@/lib/bonus";
import { sendPushToUser } from "@/lib/push";
import { bestEffort } from "@/lib/best-effort";

type Status =
  | "pending"
  | "diproses"
  | "dijemput"
  | "diisi"
  | "diantar"
  | "selesai"
  | "batal";

/**
 * State machine yang sah. Selesai & batal terminal.
 * Boleh batal kapan saja (kecuali sudah selesai/batal).
 */
const VALID_TRANSITIONS: Record<Status, readonly Status[]> = {
  pending: ["diproses", "dijemput", "batal"],
  diproses: ["diantar", "batal"], // antar-saja flow
  dijemput: ["diisi", "batal"], // jemput-antar flow
  diisi: ["diantar", "batal"],
  diantar: ["selesai", "batal"],
  selesai: [],
  batal: [],
};

export async function updateOrderStatus(orderId: number, status: Status) {
  const session = await requireRole(["admin", "kasir"]);

  const current = await db.query.orderHeader.findFirst({
    where: eq(orderHeader.id, orderId),
  });
  if (!current) throw new Error("Order tidak ditemukan");

  // Validasi state machine
  if (current.status === status) return; // idempoten
  const allowed = VALID_TRANSITIONS[current.status];
  if (!allowed.includes(status)) {
    throw new Error(
      `Transisi tidak sah: ${current.status} → ${status}. Yang diizinkan: ${allowed.join(", ") || "(terminal)"}`,
    );
  }

  const update: Partial<typeof orderHeader.$inferInsert> = {
    status,
    updatedAt: new Date(),
  };
  // Auto-assign kurir hanya jika belum ada
  if (
    (status === "diproses" || status === "diantar" || status === "dijemput") &&
    !current.kurirUserId
  ) {
    update.kurirUserId = session.user.id;
  }

  // Set timestamps khusus per status
  if (status === "dijemput") {
    (update as Record<string, unknown>).dijemputAt = new Date();
  } else if (status === "diisi") {
    (update as Record<string, unknown>).diisiAt = new Date();
  }

  await db.update(orderHeader).set(update).where(eq(orderHeader.id, orderId));

  // Notif grup Telegram per perubahan status (best-effort, tidak blok flow)
  bestEffort("notifStatusKeGrup", notifStatusKeGrup(orderId, status, session.user.name));

  // Notif pelanggan tiap status berubah
  bestEffort("notifPelangganStatus", notifPelangganStatus(orderId, status));

  // Earn loyalty kalau order selesai & sudah lunas
  if (status === "selesai") {
    bestEffort("earnFromOrderIfEligible", earnFromOrderIfEligible(orderId));
  }

  // Saat order dibatalkan, reverse loyalty (idempoten — no-op kalau belum
  // pernah earn) dan hapus bonus kurir pending. Defense-in-depth: state
  // machine sekarang cegah cancel pasca-selesai, tapi safety net tetap ada.
  if (status === "batal") {
    bestEffort("reverseLoyaltyForOrder", reverseLoyaltyForOrder(orderId));
    bestEffort("reverseBonusForOrder", reverseBonusForOrder(orderId).then(() => {}));
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

  const emoji: Record<Status, string> = {
    pending: "🔔",
    diproses: "🔧",
    dijemput: "🛵",
    diisi: "💧",
    diantar: "🚚",
    selesai: "✅",
    batal: "❌",
  };

  const text = [
    `${emoji[status]} *${order.nomorOrder}* — _${status}_`,
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

export async function notifPelangganStatus(orderId: number, status: Status) {
  const order = await db.query.orderHeader.findFirst({
    where: eq(orderHeader.id, orderId),
  });
  if (!order || !order.pelangganId) return;
  const pel = await db.query.pelanggan.findFirst({ where: eq(pelanggan.id, order.pelangganId) });
  if (!pel) return;

  const namaDepotRow = await db.query.pengaturan.findFirst({
    where: eq(pengaturan.key, "namaDepot"),
  });
  const namaDepot = namaDepotRow?.value ?? "Depot Air";

  let text: string | null = null;
  switch (status) {
    case "diproses":
      text = `🔧 Order *${order.nomorOrder}* sedang diproses oleh ${namaDepot}.`;
      break;
    case "dijemput":
      text = `🛵 Kurir berangkat menjemput galon kosong Anda untuk order *${order.nomorOrder}*.`;
      break;
    case "diisi":
      text = `💧 Galon Anda sedang diisi di depot. Order *${order.nomorOrder}*.`;
      break;
    case "diantar": {
      const baseUrl = process.env.BETTER_AUTH_URL ?? "https://depot.genster.my.id";
      const trackUrl = order.trackingToken
        ? `${baseUrl}/track/${order.id}?token=${order.trackingToken}`
        : null;
      text = `🚚 Kurir berangkat antar pesanan *${order.nomorOrder}*. Mohon disiapkan.${
        trackUrl ? `\n\nLacak posisi kurir: ${trackUrl}` : ""
      }`;
      break;
    }
    case "selesai":
      text = await renderTemplate("templateNotifOrderSelesaiPelanggan", {
        nomorOrder: order.nomorOrder,
        total: formatRupiah(order.totalEstimasi),
        namaDepot,
      });
      if (!text) text = `✅ Order *${order.nomorOrder}* selesai. Terima kasih.`;
      break;
    case "batal":
      text = `❌ Order *${order.nomorOrder}* dibatalkan.`;
      break;
  }
  if (!text) return;

  if (pel.userId) {
    const u = await db.query.user.findFirst({ where: eq(userTable.id, pel.userId) });
    if (u?.telegramChatId) await sendTelegram(u.telegramChatId, text).catch(() => {});
    // Push notif (browser/PWA)
    sendPushToUser(pel.userId, {
      title: `Order ${order.nomorOrder}`,
      body: text.replace(/\*/g, "").split("\n")[0],
      url: `/pelanggan/riwayat`,
      tag: `order-${order.nomorOrder}`,
      renotify: true,
    }).catch(() => {});
  }
  if (pel.telp) await sendWhatsApp(pel.telp, text).catch(() => {});
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
