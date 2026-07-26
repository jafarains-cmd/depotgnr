import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { produk } from "./produk";

/**
 * Master supplier — reusable untuk pembelian galon.
 * Simple: hanya nama + kontak + aktif flag.
 */
export const supplier = sqliteTable(
  "supplier",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nama: text("nama").notNull(),
    telp: text("telp"),
    alamat: text("alamat"),
    catatan: text("catatan"),
    aktif: integer("aktif", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    aktifIdx: index("supplier_aktif_idx").on(t.aktif),
  }),
);

/**
 * Pembelian galon dari supplier. 2 skenario:
 *  - jenis="kosong" → galon kosong untuk pool pinjaman + isi ulang
 *  - jenis="terisi" → galon terisi dari brand lain (reseller)
 *
 * Setiap pembelian:
 *  - Auto tambah stok (kosong atau terisi sesuai jenis)
 *  - Auto insert pengeluaran kategori "beli-galon" (linked via refPengeluaranId)
 *  - Update produk.hargaPokok = hargaSatuan (harga pokok terakhir)
 */
export const pembelianGalon = sqliteTable(
  "pembelian_galon",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tanggal: integer("tanggal", { mode: "timestamp" }).notNull(),
    produkId: integer("produk_id")
      .notNull()
      .references(() => produk.id, { onDelete: "cascade" }),
    supplierId: integer("supplier_id").references(() => supplier.id, {
      onDelete: "set null",
    }),
    jenis: text("jenis", { enum: ["kosong", "terisi"] }).notNull(),
    jumlah: integer("jumlah").notNull(),
    hargaSatuan: integer("harga_satuan").notNull(),
    totalHarga: integer("total_harga").notNull(),
    noInvoice: text("no_invoice"),
    fotoNotaUrl: text("foto_nota_url"),
    catatan: text("catatan"),
    // Auto-link ke pengeluaran yang dibuat otomatis saat catat pembelian.
    // Kalau pengeluaran-nya dihapus terpisah, ref jadi NULL (audit trail
    // tetap terjaga di pembelian_galon).
    refPengeluaranId: integer("ref_pengeluaran_id"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    tanggalIdx: index("pembelian_galon_tanggal_idx").on(t.tanggal),
    produkIdx: index("pembelian_galon_produk_idx").on(t.produkId),
    supplierIdx: index("pembelian_galon_supplier_idx").on(t.supplierId),
  }),
);

export type Supplier = typeof supplier.$inferSelect;
export type NewSupplier = typeof supplier.$inferInsert;
export type PembelianGalon = typeof pembelianGalon.$inferSelect;
export type NewPembelianGalon = typeof pembelianGalon.$inferInsert;
