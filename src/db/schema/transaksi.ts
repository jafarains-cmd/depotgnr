import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { produk } from "./produk";
import { pelanggan } from "./pelanggan";
import { user } from "./auth";

export const transaksi = sqliteTable("transaksi", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nomorNota: text("nomor_nota").notNull().unique(),
  kasirUserId: text("kasir_user_id").references(() => user.id, { onDelete: "set null" }),
  pelangganId: integer("pelanggan_id").references(() => pelanggan.id, { onDelete: "set null" }),
  subtotal: integer("subtotal").notNull().default(0),
  diskon: integer("diskon").notNull().default(0),
  total: integer("total").notNull().default(0),
  metodeBayar: text("metode_bayar", { enum: ["cash", "transfer", "qris"] }).notNull().default("cash"),
  status: text("status", { enum: ["lunas", "hutang"] }).notNull().default("lunas"),
  catatan: text("catatan"),
  refOrderId: integer("ref_order_id"),
  sheetRowId: text("sheet_row_id"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  voidedAt: integer("voided_at", { mode: "timestamp" }),
  voidedBy: text("voided_by").references(() => user.id, { onDelete: "set null" }),
  voidedAlasan: text("voided_alasan"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const transaksiItem = sqliteTable("transaksi_item", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  transaksiId: integer("transaksi_id")
    .notNull()
    .references(() => transaksi.id, { onDelete: "cascade" }),
  produkId: integer("produk_id")
    .notNull()
    .references(() => produk.id),
  qty: integer("qty").notNull(),
  hargaSatuan: integer("harga_satuan").notNull(),
  subtotal: integer("subtotal").notNull(),
  jenis: text("jenis", { enum: ["isi_ulang", "tukar", "beli_baru"] }).notNull(),
});

export type Transaksi = typeof transaksi.$inferSelect;
export type NewTransaksi = typeof transaksi.$inferInsert;
export type TransaksiItem = typeof transaksiItem.$inferSelect;
