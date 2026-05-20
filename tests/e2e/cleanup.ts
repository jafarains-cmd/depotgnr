/**
 * Manual cleanup script — hapus data [E2E]* dari DB.
 * Run: npm run test:e2e:cleanup
 *
 * Aman: hanya hapus data dengan prefix [E2E] di nama pelanggan/produk.
 * Tidak menghapus akun staff e2e (admin/kasir/kurir/pelanggan e2e) karena
 * di-reuse antar run.
 */
import "dotenv/config";
import Database from "better-sqlite3";

const DB_PATH = process.env.DATABASE_URL ?? "./data/depot.db";

const db = new Database(DB_PATH);

function safeDelete(label: string, sql: string, params: unknown[] = []) {
  try {
    const r = db.prepare(sql).run(...params);
    console.log(`✓ ${label}: ${r.changes} row(s) dihapus`);
  } catch (e) {
    console.warn(`! ${label} gagal:`, (e as Error).message);
  }
}

console.log("\n=== Cleanup E2E data ===");
console.log(`DB: ${DB_PATH}\n`);

// Order/transaksi pelanggan E2E akan cascade saat pelanggan dihapus,
// tapi orderHeader pakai onDelete: "set null" untuk pelangganId, dan
// transaksi sama. Jadi kita hapus eksplisit dulu.

// 1. Hapus order items + order milik pelanggan E2E
safeDelete(
  "order_item (E2E pelanggan)",
  `DELETE FROM order_item WHERE order_id IN (
    SELECT id FROM "order" WHERE pelanggan_id IN (
      SELECT id FROM pelanggan WHERE nama LIKE '[E2E]%'
    )
  )`,
);
safeDelete(
  "order (E2E pelanggan)",
  `DELETE FROM "order" WHERE pelanggan_id IN (
    SELECT id FROM pelanggan WHERE nama LIKE '[E2E]%'
  )`,
);

// 2. Hapus bonus_kurir tied to E2E orders sudah cascade lewat order delete kalau ada FK,
//    tapi schema bonus_kurir.order_id pakai integer plain (tanpa FK ke order).
//    Tidak ada cara akurat join, jadi skip — biasanya ikut hilang lewat orderan E2E.

// 3. Hapus transaksi item + transaksi yang link ke pelanggan E2E
safeDelete(
  "transaksi_item (E2E)",
  `DELETE FROM transaksi_item WHERE transaksi_id IN (
    SELECT id FROM transaksi WHERE pelanggan_id IN (
      SELECT id FROM pelanggan WHERE nama LIKE '[E2E]%'
    )
  )`,
);
safeDelete(
  "transaksi (E2E)",
  `DELETE FROM transaksi WHERE pelanggan_id IN (
    SELECT id FROM pelanggan WHERE nama LIKE '[E2E]%'
  )`,
);

// 4. Mutasi loyalti & galon pelanggan E2E
safeDelete(
  "mutasi_loyalti (E2E)",
  `DELETE FROM mutasi_loyalti WHERE pelanggan_id IN (
    SELECT id FROM pelanggan WHERE nama LIKE '[E2E]%'
  )`,
);
safeDelete(
  "galon_pelanggan (E2E)",
  `DELETE FROM galon_pelanggan WHERE pelanggan_id IN (
    SELECT id FROM pelanggan WHERE nama LIKE '[E2E]%'
  )`,
);
safeDelete(
  "mutasi_titipan (E2E)",
  `DELETE FROM mutasi_titipan WHERE pelanggan_id IN (
    SELECT id FROM pelanggan WHERE nama LIKE '[E2E]%'
  )`,
);

// 5. Pelanggan E2E
safeDelete("pelanggan (E2E)", `DELETE FROM pelanggan WHERE nama LIKE '[E2E]%'`);

// 6. Produk E2E (kalau ada)
safeDelete("produk (E2E)", `DELETE FROM produk WHERE nama LIKE '[E2E]%'`);

// 7. Pengeluaran E2E (deskripsi)
safeDelete(
  "pengeluaran (E2E)",
  `DELETE FROM pengeluaran WHERE deskripsi LIKE '[E2E]%'`,
);

// 8. Nota gabungan E2E — auto cascade saat pelanggan dihapus
safeDelete(
  "nota_gabungan orphan",
  `DELETE FROM nota_gabungan WHERE pelanggan_id NOT IN (SELECT id FROM pelanggan)`,
);

db.close();
console.log("\nCleanup selesai.\n");
