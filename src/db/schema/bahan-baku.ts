import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

/**
 * Bahan baku consumable: tutup galon, segel, label, dll.
 * Beda dari stok_galon yang tracking galon per status.
 */
export const bahanBaku = sqliteTable(
  "bahan_baku",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nama: text("nama").notNull(),
    satuan: text("satuan").notNull().default("pcs"), // pcs, kg, liter, dll
    stok: integer("stok").notNull().default(0),
    threshold: integer("threshold").notNull().default(0), // alert kalau stok < threshold
    hargaSatuan: integer("harga_satuan").notNull().default(0), // optional, untuk auto-cost
    aktif: integer("aktif", { mode: "boolean" }).notNull().default(true),
    catatan: text("catatan"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    aktifIdx: index("bahan_baku_aktif_idx").on(t.aktif),
  }),
);

export const mutasiBahanBaku = sqliteTable(
  "mutasi_bahan_baku",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bahanId: integer("bahan_id")
      .notNull()
      .references(() => bahanBaku.id, { onDelete: "cascade" }),
    perubahan: integer("perubahan").notNull(), // positif=masuk, negatif=keluar
    alasan: text("alasan").notNull(), // beli, pakai, rusak, koreksi, dll
    biaya: integer("biaya").notNull().default(0), // total biaya (untuk masuk)
    catatan: text("catatan"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    bahanDateIdx: index("mutasi_bahan_baku_bahan_date_idx").on(t.bahanId, t.createdAt),
  }),
);

export type BahanBaku = typeof bahanBaku.$inferSelect;
export type MutasiBahanBaku = typeof mutasiBahanBaku.$inferSelect;
