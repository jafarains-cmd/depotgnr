/**
 * Backfill shift_id untuk transaksi/order yang belum ter-tag.
 *
 * Rule:
 *  1. Transaksi.shiftId = null AND transaksi.refOrderId != null:
 *     → ambil shift_id dari order.shiftId (inherit dari order asal)
 *  2. Transaksi.shiftId = null AND transaksi.kasirUserId != null:
 *     → cari shift kasir yang openedAt <= transaksi.createdAt <= closedAt
 *       (atau status=open dan openedAt <= createdAt)
 *     → tag transaksi ke shift itu
 *  3. Order.shiftId = null AND createdAt cocok dengan shift kasir/kurir:
 *     → tag (lebih hati-hati, banyak null kasirUserId)
 *
 * Run: npm run db:backfill-shift
 * Aman dijalankan ulang.
 */
import "dotenv/config";
import { eq, and, lt, gte, lte, isNull, sql, or } from "drizzle-orm";
import { db } from "./index";
import { transaksi } from "./schema/transaksi";
import { orderHeader } from "./schema/order";
import { shiftKasir } from "./schema/shift";

async function main() {
  console.log("→ Backfill shift_id...\n");

  let fixedFromOrder = 0;
  let fixedFromKasirTime = 0;

  // 1. Transaksi tanpa shift_id tapi punya refOrderId → inherit dari order
  const trxNeedOrder = await db
    .select({
      id: transaksi.id,
      refOrderId: transaksi.refOrderId,
    })
    .from(transaksi)
    .where(and(isNull(transaksi.shiftId), sql`${transaksi.refOrderId} IS NOT NULL`));

  console.log(`Transaksi tanpa shift, ada refOrderId: ${trxNeedOrder.length}`);

  for (const t of trxNeedOrder) {
    if (!t.refOrderId) continue;
    const o = await db.query.orderHeader.findFirst({
      where: eq(orderHeader.id, t.refOrderId),
    });
    if (o?.shiftId) {
      await db.update(transaksi).set({ shiftId: o.shiftId }).where(eq(transaksi.id, t.id));
      fixedFromOrder++;
    }
  }

  // 2. Transaksi tanpa shift_id, cari shift kasir yang aktif saat itu
  const trxNeedShift = await db
    .select({
      id: transaksi.id,
      kasirUserId: transaksi.kasirUserId,
      createdAt: transaksi.createdAt,
    })
    .from(transaksi)
    .where(and(isNull(transaksi.shiftId), sql`${transaksi.kasirUserId} IS NOT NULL`));

  console.log(`Transaksi tanpa shift, ada kasirUserId: ${trxNeedShift.length}`);

  for (const t of trxNeedShift) {
    if (!t.kasirUserId) continue;
    // Cari shift kasir yang range nya cocok dengan createdAt
    const candidates = await db
      .select({
        id: shiftKasir.id,
        openedAt: shiftKasir.openedAt,
        closedAt: shiftKasir.closedAt,
      })
      .from(shiftKasir)
      .where(
        and(
          eq(shiftKasir.kasirUserId, t.kasirUserId),
          lte(shiftKasir.openedAt, t.createdAt),
        ),
      );
    const fit = candidates.find((s) => {
      if (s.closedAt === null) return true; // shift open, valid
      return s.closedAt >= t.createdAt;
    });
    if (fit) {
      await db.update(transaksi).set({ shiftId: fit.id }).where(eq(transaksi.id, t.id));
      fixedFromKasirTime++;
    }
  }

  console.log(`\n✓ Selesai.`);
  console.log(`  Transaksi diisi via order: ${fixedFromOrder}`);
  console.log(`  Transaksi diisi via kasir+waktu: ${fixedFromKasirTime}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
