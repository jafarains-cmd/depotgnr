import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { pelanggan } from "./pelanggan";
import { user } from "./auth";

export const notaGabungan = sqliteTable(
  "nota_gabungan",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kode: text("kode").notNull().unique(),
    pelangganId: integer("pelanggan_id")
      .notNull()
      .references(() => pelanggan.id, { onDelete: "cascade" }),
    totalEstimasi: integer("total_estimasi").notNull().default(0),
    totalGalon: integer("total_galon").notNull().default(0),
    jumlahOrder: integer("jumlah_order").notNull().default(0),
    dibuatOleh: text("dibuat_oleh").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    pelangganIdx: index("nota_gabungan_pelanggan_idx").on(t.pelangganId),
  }),
);

export type NotaGabungan = typeof notaGabungan.$inferSelect;
