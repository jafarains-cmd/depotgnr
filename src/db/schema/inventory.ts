import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { produk } from "./produk";

export const stokGalon = sqliteTable("stok_galon", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  produkId: integer("produk_id")
    .notNull()
    .references(() => produk.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["kosong", "terisi", "rusak"] }).notNull(),
  jumlah: integer("jumlah").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const mutasiStok = sqliteTable("mutasi_stok", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  produkId: integer("produk_id")
    .notNull()
    .references(() => produk.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["kosong", "terisi", "rusak"] }).notNull(),
  perubahan: integer("perubahan").notNull(),
  alasan: text("alasan").notNull(),
  refTransaksiId: integer("ref_transaksi_id"),
  refOrderId: integer("ref_order_id"),
  userId: text("user_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type StokGalon = typeof stokGalon.$inferSelect;
export type MutasiStok = typeof mutasiStok.$inferSelect;
