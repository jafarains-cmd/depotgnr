import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { kategoriBiaya } from "./kategori-biaya";

export const pengeluaran = sqliteTable(
  "pengeluaran",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tanggal: integer("tanggal", { mode: "timestamp" }).notNull(),
    /** Slug lama (backward-compat). Baru: pakai kategori_biaya_id. */
    kategori: text("kategori").notNull(),
    /** FK ke master kategori_biaya. Nullable untuk data lama. */
    kategoriBiayaId: integer("kategori_biaya_id").references(() => kategoriBiaya.id, {
      onDelete: "set null",
    }),
    jumlah: integer("jumlah").notNull(),
    deskripsi: text("deskripsi"),
    fotoNotaUrl: text("foto_nota_url"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    shiftId: integer("shift_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    tanggalIdx: index("pengeluaran_tanggal_idx").on(t.tanggal),
    kategoriIdx: index("pengeluaran_kategori_idx").on(t.kategori),
    kategoriBiayaIdx: index("pengeluaran_kategori_biaya_idx").on(t.kategoriBiayaId),
  }),
);

export type Pengeluaran = typeof pengeluaran.$inferSelect;
export type NewPengeluaran = typeof pengeluaran.$inferInsert;
