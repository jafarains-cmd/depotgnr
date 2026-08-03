import { sqliteTable, text, integer, index, unique } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

/**
 * Rekonsiliasi harian mutasi bank / QRIS merchant vs omzet sistem.
 *
 * Setiap hari admin cek mobile banking + QRIS merchant, input saldo yang
 * benar-benar masuk, sistem hitung selisih vs omzet non-cash yang dicatat.
 *
 * 1 hari punya 2 baris: satu untuk transfer, satu untuk qris (kalau ada).
 */
export const rekonsiliasiBank = sqliteTable(
  "rekonsiliasi_bank",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tanggal: integer("tanggal", { mode: "timestamp" }).notNull(),
    metode: text("metode", { enum: ["transfer", "qris"] }).notNull(),
    omzetSistem: integer("omzet_sistem").notNull(),
    saldoAktual: integer("saldo_aktual").notNull(),
    selisih: integer("selisih").notNull(),
    catatan: text("catatan"),
    buktiFotoUrl: text("bukti_foto_url"),
    verifiedBy: text("verified_by").references(() => user.id, {
      onDelete: "set null",
    }),
    verifiedAt: integer("verified_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    tanggalIdx: index("rekonsiliasi_tanggal_idx").on(t.tanggal),
    uniquePerHari: unique("rekonsiliasi_tanggal_metode_uniq").on(t.tanggal, t.metode),
  }),
);

export type RekonsiliasiBank = typeof rekonsiliasiBank.$inferSelect;
export type NewRekonsiliasiBank = typeof rekonsiliasiBank.$inferInsert;
