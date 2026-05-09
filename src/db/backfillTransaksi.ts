/**
 * Backfill: insert row `transaksi` untuk order selesai+lunas yang belum
 * ter-sync, DAN perbaiki createdAt transaksi existing supaya match
 * timestamp asli order (selesaiAt / bayarAt / diantarAt / createdAt).
 *
 * Run: npm run db:backfill-transaksi
 * Aman dijalankan ulang.
 */
import "dotenv/config";
import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "./index";
import { orderHeader } from "./schema/order";
import { transaksi } from "./schema/transaksi";
import { syncTransaksiFromOrder } from "../lib/transaksi-sync";

async function main() {
  const orders = await db
    .select({
      id: orderHeader.id,
      nomorOrder: orderHeader.nomorOrder,
      selesaiAt: orderHeader.selesaiAt,
      bayarAt: orderHeader.bayarAt,
      diantarAt: orderHeader.diantarAt,
      createdAt: orderHeader.createdAt,
    })
    .from(orderHeader)
    .where(and(eq(orderHeader.status, "selesai"), eq(orderHeader.statusBayar, "lunas")));

  console.log(`→ Found ${orders.length} order selesai+lunas`);

  let created = 0;
  let fixed = 0;
  let errored = 0;

  for (const o of orders) {
    try {
      // Insert kalau belum ada
      await syncTransaksiFromOrder(o.id);

      // Pastikan timestamp transaksi match order asli
      const targetCreatedAt = o.selesaiAt ?? o.bayarAt ?? o.diantarAt ?? o.createdAt;
      const t = await db.query.transaksi.findFirst({
        where: eq(transaksi.refOrderId, o.id),
      });
      if (t && targetCreatedAt && t.createdAt.getTime() !== targetCreatedAt.getTime()) {
        await db
          .update(transaksi)
          .set({ createdAt: targetCreatedAt })
          .where(eq(transaksi.id, t.id));
        fixed++;
      } else if (t) {
        created++;
      }
    } catch (e) {
      console.error(`  ✗ ${o.nomorOrder}:`, e instanceof Error ? e.message : e);
      errored++;
    }
  }

  // Stats sampingan: berapa total transaksi yang punya refOrderId
  const synced = await db
    .select({ id: transaksi.id })
    .from(transaksi)
    .where(isNotNull(transaksi.refOrderId));
  console.log(
    `✓ Done. ada=${created}, timestamp-fixed=${fixed}, error=${errored}, total-synced=${synced.length}`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
