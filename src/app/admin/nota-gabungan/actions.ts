"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader, orderItem } from "@/db/schema/order";
import { notaGabungan } from "@/db/schema/nota-gabungan";
import { requireRole } from "@/lib/permissions";
import { generateNomorNota } from "@/lib/utils";
import { bestEffort } from "@/lib/best-effort";
import { earnFromOrderIfEligible } from "@/lib/loyalty";
import { recordKurirBonus } from "@/lib/bonus";
import { syncTransaksiFromOrder } from "@/lib/transaksi-sync";

/**
 * Tandai semua order yang dipilih jadi lunas (idempoten — order yang sudah
 * lunas dilewati). Loop konfirmasi tiap order supaya side-effect (loyalty,
 * bonus kurir, sync transaksi) tetap jalan per order.
 */
export async function tandaiLunasBatch(
  orderIds: number[],
): Promise<{ ok: true; ditandai: number; sudahLunas: number } | { error: string }> {
  const session = await requireRole(["admin", "kasir"]);
  if (orderIds.length === 0) return { error: "Tidak ada order yang dipilih" };

  const orders = await db
    .select()
    .from(orderHeader)
    .where(inArray(orderHeader.id, orderIds));

  let ditandai = 0;
  let sudahLunas = 0;
  for (const o of orders) {
    if (o.statusBayar === "lunas") {
      sudahLunas++;
      continue;
    }
    await db
      .update(orderHeader)
      .set({
        statusBayar: "lunas",
        bayarAt: new Date(),
        bayarDikonfirmasiOleh: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(orderHeader.id, o.id));
    ditandai++;

    bestEffort(`earnFromOrderIfEligible(${o.nomorOrder})`, earnFromOrderIfEligible(o.id));
    bestEffort(`recordKurirBonus(${o.nomorOrder})`, recordKurirBonus(o.id));
    bestEffort(`syncTransaksiFromOrder(${o.nomorOrder})`, syncTransaksiFromOrder(o.id));
  }

  revalidatePath("/pembayaran");
  revalidatePath("/admin/nota-gabungan");
  revalidatePath("/admin/nota-gabungan/cetak");
  return { ok: true, ditandai, sudahLunas };
}

/**
 * Pastikan grup nota gabungan untuk orderIds tersedia di DB.
 * Idempoten: kalau orderIds tepat sama dengan grup existing, pakai kode itu.
 * Validasi: minimal 2 order, semua dari pelanggan sama, semua belum lunas,
 * tidak ada yang sudah ditugaskan ke grup lain.
 */
export async function ensureNotaGabungan(args: {
  orderIds: number[];
}): Promise<
  | { ok: true; id: number; kode: string }
  | { error: string }
> {
  const session = await requireRole(["admin", "kasir"]);
  const orderIds = [...new Set(args.orderIds)].sort((a, b) => a - b);
  if (orderIds.length < 2) {
    return { error: "Nota gabungan butuh minimal 2 order" };
  }

  const orders = await db
    .select()
    .from(orderHeader)
    .where(inArray(orderHeader.id, orderIds));

  if (orders.length !== orderIds.length) {
    return { error: "Beberapa order tidak ditemukan" };
  }

  // Pelanggan harus sama
  const pelIds = [...new Set(orders.map((o) => o.pelangganId))];
  if (pelIds.length !== 1 || pelIds[0] === null) {
    return { error: "Order harus dari pelanggan yang sama (dan bukan walk-in tanpa pelanggan)" };
  }
  const pelangganId = pelIds[0]!;

  // Semua harus belum lunas
  const adaLunas = orders.find((o) => o.statusBayar === "lunas");
  if (adaLunas) {
    return {
      error: `Tidak bisa gabung: ${adaLunas.nomorOrder} sudah lunas. Grup hanya untuk piutang.`,
    };
  }

  // Cek apakah ada yang sudah di grup lain
  const sudahDiGrup = orders.filter((o) => o.notaGabunganId !== null);
  if (sudahDiGrup.length > 0) {
    // Kalau semua order yang dipilih sama dengan isi grup existing → idempoten, reuse
    const grupIds = [...new Set(sudahDiGrup.map((o) => o.notaGabunganId!))];
    if (grupIds.length === 1) {
      const grupId = grupIds[0];
      // Hitung semua order di grup itu
      const orderDiGrup = await db
        .select({ id: orderHeader.id })
        .from(orderHeader)
        .where(eq(orderHeader.notaGabunganId, grupId));
      const idsInGrup = orderDiGrup.map((r) => r.id).sort((a, b) => a - b);
      const sama =
        idsInGrup.length === orderIds.length &&
        idsInGrup.every((id, i) => id === orderIds[i]);
      if (sama) {
        const grup = await db.query.notaGabungan.findFirst({
          where: eq(notaGabungan.id, grupId),
        });
        if (grup) return { ok: true, id: grup.id, kode: grup.kode };
      }
    }
    return {
      error: `Order ${sudahDiGrup[0].nomorOrder} sudah di grup lain. Lepas dulu dari grup tersebut.`,
    };
  }

  // Hitung total galon (ambil dari order_item)
  const items = await db
    .select({ orderId: orderItem.orderId, qty: orderItem.qty })
    .from(orderItem)
    .where(inArray(orderItem.orderId, orderIds));
  const totalGalon = items.reduce((s, it) => s + it.qty, 0);
  const totalEstimasi = orders.reduce((s, o) => s + o.totalEstimasi, 0);

  // Insert grup baru
  const kode = generateNomorNota("GAB");
  const [created] = await db
    .insert(notaGabungan)
    .values({
      kode,
      pelangganId,
      totalEstimasi,
      totalGalon,
      jumlahOrder: orderIds.length,
      dibuatOleh: session.user.id,
    })
    .returning();

  // Stamp ke semua order
  await db
    .update(orderHeader)
    .set({ notaGabunganId: created.id, updatedAt: new Date() })
    .where(inArray(orderHeader.id, orderIds));

  // Catatan: tidak panggil revalidatePath di sini karena helper ini
  // dipanggil dari Server Component render (cetak page). revalidatePath
  // hanya legal di Server Action/Route Handler.
  return { ok: true, id: created.id, kode: created.kode };
}

/**
 * Lepas grup nota gabungan. Hanya boleh kalau semua order di grup masih belum lunas.
 */
export async function lepasNotaGabungan(
  grupId: number,
): Promise<{ ok: true } | { error: string }> {
  await requireRole(["admin", "kasir"]);
  const orders = await db
    .select()
    .from(orderHeader)
    .where(eq(orderHeader.notaGabunganId, grupId));
  if (orders.some((o) => o.statusBayar === "lunas")) {
    return { error: "Tidak bisa lepas: ada order di grup ini yang sudah dibayar" };
  }
  await db
    .update(orderHeader)
    .set({ notaGabunganId: null, updatedAt: new Date() })
    .where(eq(orderHeader.notaGabunganId, grupId));
  await db.delete(notaGabungan).where(eq(notaGabungan.id, grupId));

  revalidatePath("/pembayaran");
  revalidatePath("/admin/nota-gabungan");
  return { ok: true };
}


