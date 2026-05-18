"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderHeader } from "@/db/schema/order";
import { requireRole } from "@/lib/permissions";
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
