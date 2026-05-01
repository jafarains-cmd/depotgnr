"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { requireRole } from "@/lib/permissions";
import { uploadBuktiKurir } from "@/lib/drive";
import { notifPelangganStatus } from "../kasir/order/actions";
import { earnFromOrderIfEligible } from "@/lib/loyalty";
import { bestEffort } from "@/lib/best-effort";

export async function mulaiAntar(
  orderId: number,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin", "kasir", "kurir"]);
  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o) return { error: "Order tidak ditemukan" };
  if (o.kurirUserId !== session.user.id) {
    const role = session.user.role;
    if (role !== "admin" && role !== "kasir") {
      return { error: "Order ini bukan tugas Anda" };
    }
  }
  // Untuk jemput-antar: dari "diisi" → diantar
  // Untuk antar-saja: dari "diproses" → diantar
  const valid =
    (o.tipePengantaran === "jemput-antar" && o.status === "diisi") ||
    (o.tipePengantaran === "antar-saja" && o.status === "diproses");
  if (!valid) {
    return { error: `Status "${o.status}" tidak valid untuk mulai antar` };
  }
  await db
    .update(orderHeader)
    .set({ status: "diantar", updatedAt: new Date() })
    .where(eq(orderHeader.id, orderId));
  bestEffort("notifPelangganStatus(diantar)", notifPelangganStatus(orderId, "diantar"));
  revalidatePath(`/kurir/${orderId}`);
  revalidatePath("/kurir");
  return { ok: true };
}

export async function konfirmasiJemput(args: {
  orderId: number;
  buktiBase64?: string;
  mimeType?: string;
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin", "kasir", "kurir"]);
  const o = await db.query.orderHeader.findFirst({
    where: eq(orderHeader.id, args.orderId),
  });
  if (!o) return { error: "Order tidak ditemukan" };
  if (o.kurirUserId !== session.user.id) {
    const role = session.user.role;
    if (role !== "admin" && role !== "kasir") {
      return { error: "Order ini bukan tugas Anda" };
    }
  }
  if (o.tipePengantaran !== "jemput-antar") {
    return { error: "Order ini bukan tipe jemput-antar" };
  }
  if (!["pending", "diproses", "dijemput"].includes(o.status)) {
    return { error: `Status "${o.status}" tidak bisa dijemput` };
  }

  let buktiUrl: string | null = null;
  if (args.buktiBase64 && args.mimeType) {
    const up = await uploadBuktiKurir({
      orderNomor: o.nomorOrder,
      base64: args.buktiBase64,
      mimeType: args.mimeType,
    });
    if (!up.ok || !up.url) {
      return { error: up.error ?? "Gagal upload bukti jemput" };
    }
    buktiUrl = up.url;
  }

  await db
    .update(orderHeader)
    .set({
      status: "dijemput",
      buktiJemputUrl: buktiUrl ?? o.buktiJemputUrl,
      dijemputAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orderHeader.id, args.orderId));

  bestEffort("notifPelangganStatus(dijemput)", notifPelangganStatus(args.orderId, "dijemput"));
  revalidatePath(`/kurir/${args.orderId}`);
  revalidatePath("/kurir");
  return { ok: true };
}

export async function tandaiDiisi(
  orderId: number,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireRole(["admin", "kasir", "kurir"]);
  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o) return { error: "Order tidak ditemukan" };
  if (o.kurirUserId !== session.user.id) {
    const role = session.user.role;
    if (role !== "admin" && role !== "kasir") {
      return { error: "Order ini bukan tugas Anda" };
    }
  }
  if (o.tipePengantaran !== "jemput-antar") {
    return { error: "Order ini bukan tipe jemput-antar" };
  }
  if (o.status !== "dijemput") {
    return { error: `Status "${o.status}" — galon harus dijemput dulu` };
  }
  await db
    .update(orderHeader)
    .set({ status: "diisi", diisiAt: new Date(), updatedAt: new Date() })
    .where(eq(orderHeader.id, orderId));
  bestEffort("notifPelangganStatus(diisi)", notifPelangganStatus(orderId, "diisi"));
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
    const role = session.user.role;
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

  // Kalau metode bayar = COD, auto-lunas saat kurir konfirmasi diantar.
  // Asumsi: kurir sudah terima cash sebelum tap konfirmasi.
  // Order online (qris/dana/transfer) tetap belum lunas — perlu konfirmasi admin di /pembayaran.
  const update: Partial<typeof orderHeader.$inferInsert> = {
    status: "selesai",
    buktiFotoUrl: up.url,
    diantarAt: new Date(),
    updatedAt: new Date(),
  };
  let codAutoLunas = false;
  if (o.metodeBayar === "cod" && o.statusBayar !== "lunas") {
    update.statusBayar = "lunas";
    update.bayarAt = new Date();
    update.bayarDikonfirmasiOleh = session.user.id;
    codAutoLunas = true;
  }

  await db.update(orderHeader).set(update).where(eq(orderHeader.id, args.orderId));

  bestEffort("notifPelangganStatus(selesai)", notifPelangganStatus(args.orderId, "selesai"));
  bestEffort("earnFromOrderIfEligible(selesai)", earnFromOrderIfEligible(args.orderId));
  revalidatePath(`/kurir/${args.orderId}`);
  revalidatePath("/kurir");
  if (codAutoLunas) revalidatePath("/pembayaran");
  return { ok: true, url: up.url };
}
