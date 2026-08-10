import { sqliteTable, text, integer, index, unique } from "drizzle-orm/sqlite-core";

/**
 * Master data kategori biaya. Dipakai untuk klasifikasi pengeluaran, pemeliharaan,
 * dan pembelian bahan baku sehingga laporan laba bisa auto-hitung:
 *  - COGS langsung (bahan baku, listrik produksi, sabun cuci galon)
 *  - Operasional (bensin, gaji, sewa)
 *  - Sparepart yang diamortisasi (membran, filter, mesin bundur)
 *
 * Sparepart punya umurHariDefault untuk perhitungan amortisasi otomatis
 * (harga_beli × hari_di_periode / umur_hari).
 */
export const kategoriBiaya = sqliteTable(
  "kategori_biaya",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Slug kebab-case untuk backward-compat dengan pengeluaran.kategori (string). */
    slug: text("slug").notNull(),
    nama: text("nama").notNull(),
    tipe: text("tipe", { enum: ["cogs", "operasional", "sparepart"] }).notNull(),
    /** Untuk sparepart: umur pakai estimasi dalam hari. Null untuk non-sparepart. */
    umurHariDefault: integer("umur_hari_default"),
    /** Harga beli tipikal (opsional, quick-input hint). */
    hargaEstimasi: integer("harga_estimasi"),
    /** Urutan tampil di dropdown. */
    urutan: integer("urutan").notNull().default(0),
    aktif: integer("aktif", { mode: "boolean" }).notNull().default(true),
    /** Kalau true, tidak boleh dihapus (seed default yang critical). */
    isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    slugUniq: unique("kategori_biaya_slug_uniq").on(t.slug),
    tipeIdx: index("kategori_biaya_tipe_idx").on(t.tipe),
    aktifIdx: index("kategori_biaya_aktif_idx").on(t.aktif),
  }),
);

export type KategoriBiaya = typeof kategoriBiaya.$inferSelect;
export type NewKategoriBiaya = typeof kategoriBiaya.$inferInsert;

export type TipeKategori = "cogs" | "operasional" | "sparepart";

export const TIPE_KATEGORI_LABEL: Record<TipeKategori, string> = {
  cogs: "COGS (Biaya Produksi)",
  operasional: "Operasional",
  sparepart: "Sparepart (Amortisasi)",
};
