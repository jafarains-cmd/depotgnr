import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { stokGalon, mutasiStok } from "@/db/schema/inventory";

/**
 * Reverse semua mutasi stok terkait 1 transaksi. Untuk tiap mutasi yang ada,
 * insert mutasi balik dengan delta berkebalikan dan update stokGalon.
 *
 * Idempoten: kalau sudah ada mutasi dengan alasan "void:..." untuk transaksiId
 * yang sama, skip.
 */
export async function reverseStokForTransaksi(
  transaksiId: number,
  userId: string,
): Promise<void> {
  const reverseAlasan = `void-transaksi:${transaksiId}`;
  const existing = await db.query.mutasiStok.findFirst({
    where: and(
      eq(mutasiStok.refTransaksiId, transaksiId),
      eq(mutasiStok.alasan, reverseAlasan),
    ),
  });
  if (existing) return;

  const rows = await db.query.mutasiStok.findMany({
    where: eq(mutasiStok.refTransaksiId, transaksiId),
  });
  if (rows.length === 0) return;

  await db.transaction((tx) => {
    for (const r of rows) {
      if (r.alasan.startsWith("void-transaksi:")) continue; // skip mutasi reverse sebelumnya
      const reverseDelta = -r.perubahan;
      const stokRow = tx
        .select()
        .from(stokGalon)
        .where(and(eq(stokGalon.produkId, r.produkId), eq(stokGalon.status, r.status)))
        .get();
      if (stokRow) {
        tx.update(stokGalon)
          .set({
            jumlah: Math.max(0, stokRow.jumlah + reverseDelta),
            updatedAt: new Date(),
          })
          .where(eq(stokGalon.id, stokRow.id))
          .run();
      } else {
        tx.insert(stokGalon)
          .values({ produkId: r.produkId, status: r.status, jumlah: Math.max(0, reverseDelta) })
          .run();
      }
      tx.insert(mutasiStok)
        .values({
          produkId: r.produkId,
          status: r.status,
          perubahan: reverseDelta,
          alasan: reverseAlasan,
          refTransaksiId: transaksiId,
          userId,
        })
        .run();
    }
  });
}

/**
 * Reverse stok untuk 1 order. Untuk order POS pickup / order antar yang
 * mutasi stoknya ditandai dengan refOrderId. Idempoten via alasan
 * "void-order:<orderId>".
 */
export async function reverseStokForOrder(
  orderId: number,
  userId: string,
): Promise<void> {
  const reverseAlasan = `void-order:${orderId}`;
  const existing = await db.query.mutasiStok.findFirst({
    where: and(
      eq(mutasiStok.refOrderId, orderId),
      eq(mutasiStok.alasan, reverseAlasan),
    ),
  });
  if (existing) return;

  const rows = await db.query.mutasiStok.findMany({
    where: eq(mutasiStok.refOrderId, orderId),
  });
  if (rows.length === 0) return;

  await db.transaction((tx) => {
    for (const r of rows) {
      if (r.alasan.startsWith("void-order:")) continue;
      const reverseDelta = -r.perubahan;
      const stokRow = tx
        .select()
        .from(stokGalon)
        .where(and(eq(stokGalon.produkId, r.produkId), eq(stokGalon.status, r.status)))
        .get();
      if (stokRow) {
        tx.update(stokGalon)
          .set({
            jumlah: Math.max(0, stokRow.jumlah + reverseDelta),
            updatedAt: new Date(),
          })
          .where(eq(stokGalon.id, stokRow.id))
          .run();
      } else {
        tx.insert(stokGalon)
          .values({ produkId: r.produkId, status: r.status, jumlah: Math.max(0, reverseDelta) })
          .run();
      }
      tx.insert(mutasiStok)
        .values({
          produkId: r.produkId,
          status: r.status,
          perubahan: reverseDelta,
          alasan: reverseAlasan,
          refOrderId: orderId,
          userId,
        })
        .run();
    }
  });
}
