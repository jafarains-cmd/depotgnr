"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { pelanggan as pelangganTable } from "@/db/schema/pelanggan";
import { requireSession } from "@/lib/permissions";
import { uploadBuktiBayar } from "@/lib/drive";
import { redeemLoyalty, earnFromOrderIfEligible } from "@/lib/loyalty";
import { recordKurirBonus } from "@/lib/bonus";
import { syncTransaksiFromOrder } from "@/lib/transaksi-sync";
import { bestEffort } from "@/lib/best-effort";
import { pelanggan as pelangganTable2 } from "@/db/schema/pelanggan";

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

export async function pakaiLoyalty(
  orderId: number,
  jumlah: number,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  const o = await db.query.orderHeader.findFirst({ where: eq(orderHeader.id, orderId) });
  if (!o) return { error: "Order tidak ditemukan" };
  if (!o.pelangganId) return { error: "Order tidak terhubung pelanggan" };

  const pel = await db.query.pelanggan.findFirst({
    where: eq(pelangganTable2.id, o.pelangganId),
  });
  if (pel?.userId !== session.user.id) return { error: "Order ini bukan milik Anda" };
  if (o.statusBayar === "lunas" || o.statusBayar === "menunggu") {
    return { error: "Tidak bisa ubah saat sudah submit/lunas" };
  }
  if (o.loyaltiDipakai > 0) {
    return { error: "Saldo sudah dipakai. Hubungi admin kalau salah." };
  }
  const max = Math.max(0, o.totalEstimasi);
  const used = Math.min(jumlah, max);
  if (used <= 0) return { error: "Jumlah tidak valid" };

  const r = await redeemLoyalty({
    pelangganId: o.pelangganId,
    jumlah: used,
    refOrderId: orderId,
    deskripsi: `Redeem di order ${o.nomorOrder}`,
  });
  if (!r.ok) return { error: r.error };

  const sisaTagihan = o.totalEstimasi - used;
  const fullLunas = sisaTagihan === 0;

  await db
    .update(orderHeader)
    .set({
      loyaltiDipakai: used,
      // Kalau loyalti cukup full → otomatis lunas, tidak perlu metode bayar online
      ...(fullLunas
        ? {
            statusBayar: "lunas" as const,
            bayarAt: new Date(),
            bayarDikonfirmasiOleh: session.user.id,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(orderHeader.id, orderId));

  if (fullLunas) {
    // Trigger side-effects sama seperti konfirmasiBayar manual:
    // earn poin galon baru + record bonus kurir (kalau sudah selesai) + sync transaksi
    bestEffort(`earnFromOrderIfEligible(${o.nomorOrder})`, earnFromOrderIfEligible(orderId));
    bestEffort(`recordKurirBonus(${o.nomorOrder})`, recordKurirBonus(orderId));
    bestEffort(`syncTransaksiFromOrder(${o.nomorOrder})`, syncTransaksiFromOrder(orderId));
  }

  revalidatePath(`/pelanggan/order/${orderId}/bayar`);
  revalidatePath("/pelanggan/riwayat");
  revalidatePath("/pembayaran");
  return { ok: true };
}
