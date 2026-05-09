import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

/**
 * Filter / komponen pemeliharaan air (carbon, sediment, membran RO, UV lamp, dll).
 * Tracking jadwal penggantian — alert dashboard kalau lewat atau mendekati.
 */
export const filter = sqliteTable(
  "filter",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nama: text("nama").notNull(),
    kategori: text("kategori", {
      enum: ["carbon", "sediment", "membran_ro", "uv_lamp", "lampu_uv", "lainnya"],
    }).notNull(),
    intervalHari: integer("interval_hari").notNull(), // periode ganti (hari)
    gantiTerakhir: integer("ganti_terakhir", { mode: "timestamp" }),
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
    aktifIdx: index("filter_aktif_idx").on(t.aktif),
  }),
);

export const filterLog = sqliteTable(
  "filter_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    filterId: integer("filter_id")
      .notNull()
      .references(() => filter.id, { onDelete: "cascade" }),
    gantiAt: integer("ganti_at", { mode: "timestamp" }).notNull(),
    gantiBy: text("ganti_by").references(() => user.id, { onDelete: "set null" }),
    biaya: integer("biaya").notNull().default(0), // optional, untuk track pengeluaran
    catatan: text("catatan"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    filterIdx: index("filter_log_filter_idx").on(t.filterId, t.gantiAt),
  }),
);

export type Filter = typeof filter.$inferSelect;
export type FilterLog = typeof filterLog.$inferSelect;
