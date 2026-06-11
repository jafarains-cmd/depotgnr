/**
 * Cleanup welcome bonus untuk pelanggan WALK-IN (userId IS NULL) yang
 * tidak seharusnya dapat — biasanya akibat backfill yang dijalankan
 * sebelum filter walk-in di-deploy.
 *
 * Logic:
 *   1. Cari pelanggan tanpa akun (userId IS NULL)
 *   2. Cek apakah punya mutasi loyalty "Welcome bonus%" dengan jumlah > 0
 *   3. Insert mutasi reverse "Welcome bonus pendaftaran — REVOKED (walk-in)"
 *   4. Kurangi saldo (max 0)
 *
 * Dry run by default. Jalankan dengan `--apply` untuk benar-benar revert.
 *
 * Run:
 *   npm run db:cleanup-walkin-welcome           # preview (dry-run)
 *   npm run db:cleanup-walkin-welcome -- --apply  # apply
 */
import "dotenv/config";
import { eq, and, sql, isNull } from "drizzle-orm";
import { db } from "./index";
import { pelanggan, mutasiLoyalti } from "./schema/pelanggan";

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`→ Cleanup welcome bonus walk-in (${apply ? "APPLY MODE" : "DRY-RUN"})\n`);

  // Cari semua mutasi welcome bonus positif untuk pelanggan tanpa akun
  const rows = await db
    .select({
      mutasiId: mutasiLoyalti.id,
      pelangganId: mutasiLoyalti.pelangganId,
      jumlah: mutasiLoyalti.jumlah,
      pelangganNama: pelanggan.nama,
      userId: pelanggan.userId,
      saldoLoyalti: pelanggan.saldoLoyalti,
    })
    .from(mutasiLoyalti)
    .leftJoin(pelanggan, eq(mutasiLoyalti.pelangganId, pelanggan.id))
    .where(
      and(
        sql`${mutasiLoyalti.deskripsi} LIKE '%Welcome bonus%'`,
        sql`${mutasiLoyalti.jumlah} > 0`,
        isNull(pelanggan.userId),
      ),
    );

  // Skip yang sudah pernah di-revoke (cek apakah ada mutasi negative "REVOKED")
  const filtered: typeof rows = [];
  for (const r of rows) {
    const revoked = await db.query.mutasiLoyalti.findFirst({
      where: and(
        eq(mutasiLoyalti.pelangganId, r.pelangganId),
        sql`${mutasiLoyalti.deskripsi} LIKE '%REVOKED (walk-in)%'`,
      ),
    });
    if (!revoked) filtered.push(r);
  }

  console.log(`Welcome bonus untuk walk-in yang akan di-revert: ${filtered.length}`);

  if (filtered.length === 0) {
    console.log("✓ Tidak ada yang perlu di-cleanup.");
    process.exit(0);
  }

  console.log("\nList:");
  let totalRevert = 0;
  for (const r of filtered) {
    console.log(
      `  - ${r.pelangganNama ?? "?"} (id ${r.pelangganId}): ${r.jumlah.toLocaleString("id-ID")}`,
    );
    totalRevert += r.jumlah;
  }
  console.log(`\nTotal revert: Rp ${totalRevert.toLocaleString("id-ID")}`);

  if (!apply) {
    console.log("\n⚠ DRY-RUN. Jalankan ulang dengan flag --apply untuk apply.");
    console.log("   npm run db:cleanup-walkin-welcome -- --apply");
    process.exit(0);
  }

  // Apply: insert mutasi reverse + kurangi saldo
  let applied = 0;
  for (const r of filtered) {
    await db.transaction((tx) => {
      tx.insert(mutasiLoyalti)
        .values({
          pelangganId: r.pelangganId,
          jumlah: -r.jumlah,
          tipe: "adjust",
          deskripsi: `Welcome bonus pendaftaran — REVOKED (walk-in tanpa akun)`,
        })
        .run();
      tx.update(pelanggan)
        .set({ saldoLoyalti: sql`max(0, ${pelanggan.saldoLoyalti} - ${r.jumlah})` })
        .where(eq(pelanggan.id, r.pelangganId))
        .run();
    });
    applied++;
  }

  console.log(`\n✓ Selesai. ${applied} welcome bonus di-revert.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
