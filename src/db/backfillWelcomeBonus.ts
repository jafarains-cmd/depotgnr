/**
 * Backfill welcome bonus untuk pelanggan AKTIF lama yang belum pernah dapat.
 *
 * Logic: cari pelanggan yang
 *   1. punya AKUN (userId != null) — kebijakan: walk-in tanpa akun tidak dapat
 *   2. punya minimal 1 transaksi non-voided (= aktif), DAN
 *   3. belum punya mutasi loyalty dengan deskripsi "Welcome bonus%"
 *
 * → kasih welcome bonus (sesuai pengaturan welcomeBonus, default 5000).
 *
 * Idempoten — aman dijalankan ulang.
 *
 * Run: npm run db:backfill-welcome
 */
import "dotenv/config";
import { eq, and, sql, isNotNull, inArray } from "drizzle-orm";
import { db } from "./index";
import { pelanggan, mutasiLoyalti } from "./schema/pelanggan";
import { transaksi } from "./schema/transaksi";
import { giveWelcomeBonus } from "../lib/pelanggan";
import { getLoyaltyConfig } from "../lib/loyalty";

async function main() {
  const cfg = await getLoyaltyConfig();
  console.log(`→ Backfill welcome bonus (nominal: Rp ${cfg.welcomeBonus.toLocaleString("id-ID")})`);

  if (cfg.welcomeBonus <= 0) {
    console.log("✗ welcomeBonus = 0, abort. Set pengaturan dulu.");
    process.exit(1);
  }

  // 1. Cari pelangganId yang punya minimal 1 transaksi aktif
  const trxPelanggan = await db
    .selectDistinct({ id: transaksi.pelangganId })
    .from(transaksi)
    .where(and(sql`${transaksi.pelangganId} IS NOT NULL`, sql`${transaksi.voidedAt} IS NULL`));

  const idsTrx = trxPelanggan.map((r) => r.id).filter((id): id is number => id !== null);
  console.log(`Pelanggan aktif (punya transaksi): ${idsTrx.length}`);

  if (idsTrx.length === 0) {
    console.log("✓ Tidak ada pelanggan aktif.");
    process.exit(0);
  }

  // 2. Filter hanya yang punya AKUN (userId != null) — exclude walk-in
  const pelangganDenganAkun = await db
    .select({ id: pelanggan.id })
    .from(pelanggan)
    .where(and(inArray(pelanggan.id, idsTrx), isNotNull(pelanggan.userId)));

  console.log(`Pelanggan aktif dengan akun: ${pelangganDenganAkun.length}`);
  console.log(`Walk-in (skip, tanpa akun): ${idsTrx.length - pelangganDenganAkun.length}`);

  let given = 0;
  let skipped = 0;

  for (const p of pelangganDenganAkun) {
    // Cek apakah sudah pernah dapat welcome bonus
    const existing = await db.query.mutasiLoyalti.findFirst({
      where: and(
        eq(mutasiLoyalti.pelangganId, p.id),
        eq(mutasiLoyalti.tipe, "adjust"),
        sql`${mutasiLoyalti.deskripsi} LIKE '%Welcome bonus%'`,
      ),
    });
    if (existing) {
      skipped++;
      continue;
    }
    // Beri welcome bonus
    await giveWelcomeBonus(p.id);
    given++;
  }

  console.log(`\n✓ Selesai.`);
  console.log(`  Welcome bonus diberi: ${given}`);
  console.log(`  Sudah pernah dapat (skip): ${skipped}`);
  console.log(`  Walk-in di-skip (no akun): ${idsTrx.length - pelangganDenganAkun.length}`);
  console.log(`  Total cost: Rp ${(given * cfg.welcomeBonus).toLocaleString("id-ID")}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
