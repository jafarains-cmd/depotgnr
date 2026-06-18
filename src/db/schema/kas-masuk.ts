import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const kasMasuk = sqliteTable(
  "kas_masuk",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tanggal: integer("tanggal", { mode: "timestamp" }).notNull(),
    kategori: text("kategori").notNull(),
    jumlah: integer("jumlah").notNull(),
    deskripsi: text("deskripsi"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    shiftId: integer("shift_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    tanggalIdx: index("kas_masuk_tanggal_idx").on(t.tanggal),
    shiftIdx: index("kas_masuk_shift_idx").on(t.shiftId),
  }),
);

export type KasMasuk = typeof kasMasuk.$inferSelect;
export type NewKasMasuk = typeof kasMasuk.$inferInsert;
