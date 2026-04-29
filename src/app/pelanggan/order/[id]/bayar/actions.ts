"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { requireSession } from "@/lib/permissions";
import { uploadBuktiBayar } from "@/lib/drive";

type Metode = "cash" | "transfer" | "qris" | "dana" | "cod";

export async function pilihMetodeBayar(
  orderId: number,
  metode: Metode,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o) return { error: "Order tidak ditemukan" };

  // Verifikasi pelanggan
  if (o.pelangganId) {
    const pel = await db.query.pelanggan.findFirst({
      where: eq(pelangganTable.id, o.pelangganId),
    });
    if (pel?.userId !== session.user.id) {
      return { error: "Order ini bukan milik Anda" };
    }
  }

  if (o.statusBayar === "lunas") {
    return { error: "Order sudah lunas" };
  }

  await db
    .update(orderHeader)
    .set({
      metodeBayar: metode,
      // COD = belum_bayar tapi metode sudah dipilih, bayar saat antar
      statusBayar: metode === "cod" ? "belum" : o.statusBayar,
      updatedAt: new Date(),
    })
    .where(eq(orderHeader.id, orderId));

  revalidatePath(`/pelanggan/order/${orderId}/bayar`);
  revalidatePath("/pelanggan/riwayat");
  return { ok: true };
}

export async function submitBuktiBayar(args: {
  orderId: number;
  base64: string;
  mimeType: string;
}): Promise<{ ok: true; url: string } | { error: string }> {
  const session = await requireSession();
  const o = await db.query.orderHeader.findFirst({
    where: eq(orderHeader.id, args.orderId),
  });
  if (!o) return { error: "Order tidak ditemukan" };

  if (o.pelangganId) {
    const pel = await db.query.pelanggan.findFirst({
      where: eq(pelangganTable.id, o.pelangganId),
    });
    if (pel?.userId !== session.user.id) {
      return { error: "Order ini bukan milik Anda" };
    }
  }

  if (!o.metodeBayar || o.metodeBayar === "cod") {
    return { error: "Pilih metode bayar online dulu (QRIS / DANA / Transfer)" };
  }

  const up = await uploadBuktiBayar({
    orderNomor: o.nomorOrder,
    base64: args.base64,
    mimeType: args.mimeType,
  });
  if (!up.ok || !up.url) return { error: up.error ?? "Gagal upload bukti" };

  await db
    .update(orderHeader)
    .set({
      buktiBayarUrl: up.url,
      statusBayar: "menunggu",
      updatedAt: new Date(),
    })
    .where(eq(orderHeader.id, args.orderId));

  revalidatePath(`/pelanggan/order/${args.orderId}/bayar`);
  revalidatePath("/pelanggan/riwayat");
  revalidatePath("/pembayaran");
  return { ok: true, url: up.url };
}
