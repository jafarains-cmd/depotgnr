import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { pelanggan } from "./pelanggan";
import { produk } from "./produk";
import { user } from "./auth";
import { transaksi } from "./transaksi";

export const orderHeader = sqliteTable("order", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nomorOrder: text("nomor_order").notNull().unique(),
  pelangganId: integer("pelanggan_id").references(() => pelanggan.id, { onDelete: "set null" }),
  sumber: text("sumber", { enum: ["web", "telegram", "whatsapp", "walk-in"] }).notNull().default("web"),
  alamatAntar: text("alamat_antar"),
  jadwalAntar: integer("jadwal_antar", { mode: "timestamp" }),
  status: text("status", {
    enum: ["pending", "diproses", "diantar", "selesai", "batal"],
  })
    .notNull()
    .default("pending"),
  kurirUserId: text("kurir_user_id").references(() => user.id, { onDelete: "set null" }),
  totalEstimasi: integer("total_estimasi").notNull().default(0),
  transaksiId: integer("transaksi_id").references(() => transaksi.id, { onDelete: "set null" }),
  catatan: text("catatan"),
  buktiFotoUrl: text("bukti_foto_url"),
  diantarAt: integer("diantar_at", { mode: "timestamp" }),
  // Pembayaran online (Fase 2)
  metodeBayar: text("metode_bayar", {
    enum: ["cash", "transfer", "qris", "dana", "cod"],
  }),
  statusBayar: text("status_bayar", {
    enum: ["belum", "menunggu", "lunas"],
  })
    .notNull()
    .default("belum"),
  buktiBayarUrl: text("bukti_bayar_url"),
  bayarAt: integer("bayar_at", { mode: "timestamp" }),
  sheetRowId: text("sheet_row_id"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const orderItem = sqliteTable("order_item", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orderHeader.id, { onDelete: "cascade" }),
  produkId: integer("produk_id")
    .notNull()
    .references(() => produk.id),
  qty: integer("qty").notNull(),
  jenis: text("jenis", { enum: ["isi_ulang", "tukar", "beli_baru"] }).notNull(),
  hargaEstimasi: integer("harga_estimasi").notNull().default(0),
});

export type OrderHeader = typeof orderHeader.$inferSelect;
export type NewOrder = typeof orderHeader.$inferInsert;
export type OrderItem = typeof orderItem.$inferSelect;
