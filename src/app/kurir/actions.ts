"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { requireRole } from "@/lib/permissions";
import { uploadBuktiKurir } from "@/lib/drive";

export async function mulaiAntar(
  orderId: number,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin", "kasir", "kurir"]);
  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o) return { error: "Order tidak ditemukan" };
  if (o.kurirUserId !== session.user.id) {
    const role = (session.user as { role?: string }).role;
    if (role !== "admin" && role !== "kasir") {
      return { error: "Order ini bukan tugas Anda" };
    }
  }
  if (o.status !== "diproses") {
    return { error: `Status saat ini "${o.status}", tidak bisa dimulai` };
  }
  await db
    .update(orderHeader)
    .set({ status: "diantar", updatedAt: new Date() })
    .where(eq(orderHeader.id, orderId));
  revalidatePath(`/kurir/${orderId}`);
  revalidatePath("/kurir");
  return { ok: true };
}

export async function konfirmasiDiantar(args: {
  orderId: number;
  buktiBase64: string;
  mimeType: string;
}): Promise<{ ok: true; url: string } | { error: string }> {
  const session = await requireRole(["admin", "kasir", "kurir"]);
  const o = await db.query.orderHeader.findFirst({
    where: eq(orderHeader.id, args.orderId),
  });
  if (!o) return { error: "Order tidak ditemukan" };
  if (o.kurirUserId !== session.user.id) {
    const role = (session.user as { role?: string }).role;
    if (role !== "admin" && role !== "kasir") {
      return { error: "Order ini bukan tugas Anda" };
    }
  }
  if (!["diproses", "diantar"].includes(o.status)) {
    return { error: `Status "${o.status}" tidak bisa diselesaikan` };
  }

  const up = await uploadBuktiKurir({
    orderNomor: o.nomorOrder,
    base64: args.buktiBase64,
    mimeType: args.mimeType,
  });
  if (!up.ok || !up.url) {
    return { error: up.error ?? "Gagal upload bukti" };
  }

  await db
    .update(orderHeader)
    .set({
      status: "selesai",
      buktiFotoUrl: up.url,
      diantarAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orderHeader.id, args.orderId));

  revalidatePath(`/kurir/${args.orderId}`);
  revalidatePath("/kurir");
  return { ok: true, url: up.url };
}
