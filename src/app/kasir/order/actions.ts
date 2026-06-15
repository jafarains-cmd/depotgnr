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
import { reverseBonusForOrder, recordKurirBonus } from "@/lib/bonus";
import { bonusKurir } from "@/db/schema/bonus";
import { syncTransaksiFromOrder, voidTransaksiFromOrder } from "@/lib/transaksi-sync";
import { reverseGalonPinjamForOrder } from "@/lib/galon-pinjam";
import { reverseStokForOrder } from "@/lib/inventory";
import { logAudit } from "@/lib/audit";
import { sendPushToUser } from "@/lib/push";
import { bestEffort } from "@/lib/best-effort";
import { uploadBuktiKurir } from "@/lib/drive";

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
  } else if (status === "selesai") {
    (update as Record<string, unknown>).selesaiAt = new Date();
  }

  await db.update(orderHeader).set(update).where(eq(orderHeader.id, orderId));

  // Notif grup Telegram per perubahan status (best-effort, tidak blok flow)
  bestEffort("notifStatusKeGrup", notifStatusKeGrup(orderId, status, session.user.name));

  // Notif pelanggan tiap status berubah
  bestEffort("notifPelangganStatus", notifPelangganStatus(orderId, status));

  // Earn loyalty kalau order selesai & sudah lunas
  if (status === "selesai") {
    bestEffort("earnFromOrderIfEligible", earnFromOrderIfEligible(orderId));
    // Sync ke transaksi kalau juga sudah lunas (idempoten — skip kalau bukan)
    bestEffort("syncTransaksiFromOrder", syncTransaksiFromOrder(orderId));
  }

  // Saat order dibatalkan, reverse loyalty (idempoten — no-op kalau belum
  // pernah earn) dan hapus bonus kurir pending. Defense-in-depth: state
  // machine sekarang cegah cancel pasca-selesai, tapi safety net tetap ada.
  if (status === "batal") {
    bestEffort("reverseLoyaltyForOrder", reverseLoyaltyForOrder(orderId));
    bestEffort("reverseBonusForOrder", reverseBonusForOrder(orderId).then(() => {}));
    bestEffort(
      "reverseGalonPinjamForOrder",
      reverseGalonPinjamForOrder(orderId, session.user.id),
    );
    // Void transaksi kalau pernah ter-sync (mis. order lunas tapi nanti dibatalkan)
    bestEffort(
      "voidTransaksiFromOrder",
      voidTransaksiFromOrder(orderId, session.user.id, "Order dibatalkan"),
    );
  }

  revalidatePath("/kasir/order");
  revalidatePath("/admin/order");
  revalidatePath("/pelanggan/beranda");
}

/**
 * Batalkan order POS piutang murni (status=selesai + statusBayar=belum).
 * Untuk kasus kasir salah input (mis. typo tipe pengantaran, salah item).
 *
 * Aturan:
 *  - Order harus status=selesai DAN statusBayar=belum (piutang murni,
 *    belum tersinkron ke transaksi)
 *  - Akses: admin (selalu) atau kasir pembuat dalam 24 jam terakhir
 *  - Alasan wajib
 *  - Reverse stok + galon pinjam, set status=batal
 *  - Audit log
 */
export async function batalkanOrderPiutang(
  orderId: number,
  alasan: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin", "kasir"]);
  const reason = alasan.trim();
  if (reason.length < 3) return { error: "Alasan wajib (min 3 karakter)" };

  const o = await db.query.orderHeader.findFirst({
    where: eq(orderHeader.id, orderId),
  });
  if (!o) return { error: "Order tidak ditemukan" };
  if (o.status !== "selesai") {
    return {
      error: `Order status "${o.status}" — pakai tombol Batal biasa, bukan fitur ini`,
    };
  }
  if (o.statusBayar === "lunas") {
    return {
      error:
        "Order sudah LUNAS dan tersinkron ke transaksi. Pakai 'Batalkan Tuntas' (admin) supaya transaksi juga di-void.",
    };
  }

  // Akses: admin bebas, kasir hanya kalau pembuat + < 24 jam
  const isAdmin = session.user.role === "admin";
  if (!isAdmin) {
    if (o.kurirUserId !== session.user.id) {
      return { error: "Hanya admin atau kasir pembuat yang bisa batalkan order ini" };
    }
    const ageMs = Date.now() - o.createdAt.getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      return { error: "Order sudah > 24 jam — minta admin yang batalkan" };
    }
  }

  // Update status → batal
  await db
    .update(orderHeader)
    .set({
      status: "batal",
      catatan: o.catatan
        ? `${o.catatan} · [BATAL oleh ${session.user.name}: ${reason}]`
        : `[BATAL oleh ${session.user.name}: ${reason}]`,
      updatedAt: new Date(),
    })
    .where(eq(orderHeader.id, orderId));

  // Reverse stok + galon pinjam
  bestEffort("reverseStokForOrder", reverseStokForOrder(orderId, session.user.id));
  bestEffort(
    "reverseGalonPinjamForOrder",
    reverseGalonPinjamForOrder(orderId, session.user.id),
  );
  // Loyalty / bonus kurir: tidak perlu reverse — belum di-trigger untuk piutang belum lunas

  await logAudit({
    actorUserId: session.user.id,
    action: "order.batal-piutang",
    entity: "order_header",
    entityId: orderId,
    before: {
      nomorOrder: o.nomorOrder,
      status: o.status,
      statusBayar: o.statusBayar,
      totalEstimasi: o.totalEstimasi,
      tipePengantaran: o.tipePengantaran,
    },
    meta: { alasan: reason },
  });

  revalidatePath("/kasir/order");
  revalidatePath("/pembayaran");
  revalidatePath("/admin/order");
  return { ok: true };
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

export async function assignKurir(
  orderId: number,
  kurirUserId: string | null,
): Promise<{ ok: true } | { error: string }> {
  // Default: kasir & admin boleh ubah kurir.
  // Kalau order sudah punya bonus tercatat (artinya selesai + lunas), hanya
  // admin yang boleh reassign — sekaligus reverse bonus lama + record bonus
  // untuk kurir baru.
  const order = await db.query.orderHeader.findFirst({
    where: eq(orderHeader.id, orderId),
  });
  if (!order) return { error: "Order tidak ditemukan" };

  const existingBonus = await db.query.bonusKurir.findFirst({
    where: eq(bonusKurir.orderId, orderId),
  });

  if (existingBonus) {
    // Reassign post-completion butuh admin
    await requireRole(["admin"]);

    if (existingBonus.status === "dibayar") {
      return {
        error:
          "Bonus untuk order ini sudah dibayar ke kurir lama. Tidak bisa direassign — bonus sudah keluar dari kas.",
      };
    }

    // Hapus bonus pending lama
    await db.delete(bonusKurir).where(eq(bonusKurir.orderId, orderId));

    // Update kurir
    await db
      .update(orderHeader)
      .set({ kurirUserId, updatedAt: new Date() })
      .where(eq(orderHeader.id, orderId));

    // Record bonus baru kalau kurir di-assign (bukan null)
    if (kurirUserId) {
      bestEffort("recordKurirBonus(reassign)", recordKurirBonus(orderId));
    }
  } else {
    await requireRole(["admin", "kasir"]);
    await db
      .update(orderHeader)
      .set({ kurirUserId, updatedAt: new Date() })
      .where(eq(orderHeader.id, orderId));
  }

  revalidatePath("/kasir/order");
  revalidatePath("/admin/order");
  revalidatePath("/admin/bonus-kurir");
  return { ok: true };
}

/**
 * Upload bukti foto antar oleh admin/kasir — fallback kalau kurir lupa
 * upload via aplikasi kurir. Tidak overwrite kalau bukti sudah ada
 * (kecuali admin set replace=true).
 */
export async function uploadBuktiAntarStaff(args: {
  orderId: number;
  base64: string;
  mimeType: string;
  replace?: boolean;
}): Promise<{ ok: true; url: string } | { error: string }> {
  await requireRole(["admin", "kasir"]);

  const order = await db.query.orderHeader.findFirst({
    where: eq(orderHeader.id, args.orderId),
  });
  if (!order) return { error: "Order tidak ditemukan" };

  if (order.buktiFotoUrl && !args.replace) {
    return { error: "Bukti sudah ada. Set replace=true untuk overwrite." };
  }

  const up = await uploadBuktiKurir({
    orderNomor: order.nomorOrder,
    base64: args.base64,
    mimeType: args.mimeType,
  });
  if (!up.ok || !up.url) {
    return { error: up.error ?? "Gagal upload bukti" };
  }

  await db
    .update(orderHeader)
    .set({
      buktiFotoUrl: up.url,
      // Set diantarAt kalau belum ada (mis. order baru di-mark selesai manual)
      diantarAt: order.diantarAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orderHeader.id, args.orderId));

  revalidatePath("/kasir/order");
  revalidatePath("/admin/order");
  return { ok: true, url: up.url };
}
