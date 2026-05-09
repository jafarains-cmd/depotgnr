/**
 * Backfill: insert row `transaksi` untuk semua order yang sudah selesai+lunas
 * tapi belum punya transaksi terkait (refOrderId).
 *
 * Run: npx tsx src/db/backfillTransaksi.ts
 *
 * Aman dijalankan ulang — syncTransaksiFromOrder idempoten (skip kalau
 * sudah ada row dengan refOrderId yang sama).
 */
import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { db } from "./index";
import { orderHeader } from "./schema/order";
import { syncTransaksiFromOrder } from "../lib/transaksi-sync";

async function main() {
  const orders = await db
    .select({ id: orderHeader.id, nomorOrder: orderHeader.nomorOrder })
    .from(orderHeader)
    .where(and(eq(orderHeader.status, "selesai"), eq(orderHeader.statusBayar, "lunas")));

  console.log(`→ Found ${orders.length} order selesai+lunas`);

  let synced = 0;
  let skipped = 0;
  for (const o of orders) {
    try {
      await syncTransaksiFromOrder(o.id);
      // Cek apakah baru di-create atau sudah ada
      // (sederhana: tetap log sebagai "processed")
      synced++;
      if (synced % 25 === 0) console.log(`  …processed ${synced}`);
    } catch (e) {
      console.error(`  ✗ ${o.nomorOrder}:`, e instanceof Error ? e.message : e);
      skipped++;
    }
  }

  console.log(`✓ Done. processed=${synced}, error=${skipped}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
