"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reminderPiutang } from "@/db/schema/reminder-piutang";
import { orderHeader } from "@/db/schema/order";
import { requireRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { StageNum } from "@/lib/reminder-piutang";

/**
 * Mark reminder sudah dikirim. Insert record ke reminder_piutang.
 * Idempoten: kalau stage sudah pernah dikirim untuk order ini, skip
 * (tapi tidak error — return ok).
 */
export async function markReminderSent(args: {
  orderId: number;
  stage: number; // 1, 2, atau 3
  catatan?: string;
}): Promise<{ ok: true; alreadySent?: boolean } | { error: string }> {
  const session = await requireRole(["admin", "kasir"]);

  const stage = args.stage as StageNum;
  if (![1, 2, 3].includes(stage)) {
    return { error: "Stage tidak valid (harus 1, 2, atau 3)" };
  }

  // Cek order exist
  const order = await db.query.orderHeader.findFirst({
    where: eq(orderHeader.id, args.orderId),
  });
  if (!order) return { error: "Order tidak ditemukan" };
  if (order.statusBayar === "lunas") {
    return { error: "Order sudah lunas, tidak perlu reminder" };
  }

  // Cek apakah stage ini sudah pernah dikirim
  const existing = await db.query.reminderPiutang.findFirst({
    where: eq(reminderPiutang.orderId, args.orderId),
    orderBy: (t, { desc }) => [desc(t.sentAt)],
  });
  if (existing && existing.stage >= stage) {
    return { ok: true, alreadySent: true };
  }

  const now = new Date();
  await db.insert(reminderPiutang).values({
    orderId: args.orderId,
    stage,
    channel: "wa-manual",
    sentAt: now,
    sentBy: session.user.id,
    catatan: args.catatan?.trim() || null,
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "reminder-piutang.sent",
    entity: "order",
    entityId: args.orderId,
    after: {
      stage,
      channel: "wa-manual",
      nomorOrder: order.nomorOrder,
    },
  });

  revalidatePath("/pembayaran");
  return { ok: true };
}

/**
 * Skip reminder untuk order tertentu — mark stage current sebagai
 * sudah "handled" supaya tidak nagging terus. Butuh alasan untuk audit.
 */
export async function skipReminderStage(args: {
  orderId: number;
  stage: number;
  alasan: string;
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin", "kasir"]);
  const reason = args.alasan.trim();
  if (reason.length < 3) return { error: "Alasan wajib (min 3 karakter)" };

  const stage = args.stage as StageNum;
  if (![1, 2, 3].includes(stage)) {
    return { error: "Stage tidak valid" };
  }

  const order = await db.query.orderHeader.findFirst({
    where: eq(orderHeader.id, args.orderId),
  });
  if (!order) return { error: "Order tidak ditemukan" };

  await db.insert(reminderPiutang).values({
    orderId: args.orderId,
    stage,
    channel: "wa-manual",
    sentAt: new Date(),
    sentBy: session.user.id,
    catatan: `[SKIP] ${reason}`,
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "reminder-piutang.skip",
    entity: "order",
    entityId: args.orderId,
    meta: { stage, alasan: reason },
  });

  revalidatePath("/pembayaran");
  return { ok: true };
}
