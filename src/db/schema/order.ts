import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { pelanggan } from "./pelanggan";
import { produk } from "./produk";
import { user } from "./auth";
import { transaksi } from "./transaksi";
import { notaGabungan } from "./nota-gabungan";

export const lokasiKurir = sqliteTable(
  "lokasi_kurir",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id").notNull(),
    kurirUserId: text("kurir_user_id").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    accuracy: real("accuracy"),
    speed: real("speed"),
    heading: real("heading"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    orderDateIdx: index("lokasi_kurir_order_date_idx").on(t.orderId, t.createdAt),
    createdAtIdx: index("lokasi_kurir_created_at_idx").on(t.createdAt), // untuk cleanup TTL
  }),
);

export const orderHeader = sqliteTable("order", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nomorOrder: text("nomor_order").notNull().unique(),
  pelangganId: integer("pelanggan_id").references(() => pelanggan.id, { onDelete: "set null" }),
  sumber: text("sumber", { enum: ["web", "telegram", "whatsapp", "walk-in"] }).notNull().default("web"),
  alamatAntar: text("alamat_antar"),
  jadwalAntar: integer("jadwal_antar", { mode: "timestamp" }),
  status: text("status", {
    enum: ["pending", "diproses", "dijemput", "diisi", "diantar", "selesai", "batal"],
  })
    .notNull()
    .default("pending"),
  tipePengantaran: text("tipe_pengantaran", {
    enum: ["antar-saja", "jemput-antar"],
  })
    .notNull()
    .default("antar-saja"),
  kurirUserId: text("kurir_user_id").references(() => user.id, { onDelete: "set null" }),
  totalEstimasi: integer("total_estimasi").notNull().default(0),
  transaksiId: integer("transaksi_id").references(() => transaksi.id, { onDelete: "set null" }),
  catatan: text("catatan"),
  buktiFotoUrl: text("bukti_foto_url"),
  buktiJemputUrl: text("bukti_jemput_url"),
  dijemputAt: integer("dijemput_at", { mode: "timestamp" }),
  diisiAt: integer("diisi_at", { mode: "timestamp" }),
  diantarAt: integer("diantar_at", { mode: "timestamp" }),
  selesaiAt: integer("selesai_at", { mode: "timestamp" }),
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
  // Audit trail: siapa staff yang konfirmasi pembayaran
  bayarDikonfirmasiOleh: text("bayar_dikonfirmasi_oleh").references(() => user.id, {
    onDelete: "set null",
  }),
  loyaltiDipakai: integer("loyalti_dipakai").notNull().default(0),
  notaGabunganId: integer("nota_gabungan_id").references(() => notaGabungan.id, {
    onDelete: "set null",
  }),
  trackingToken: text("tracking_token"),
  sheetRowId: text("sheet_row_id"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  pelangganDateIdx: index("order_pelanggan_date_idx").on(t.pelangganId, t.createdAt),
  statusDateIdx: index("order_status_date_idx").on(t.status, t.createdAt),
  kurirStatusIdx: index("order_kurir_status_idx").on(t.kurirUserId, t.status),
  notaGabunganIdx: index("order_nota_gabungan_idx").on(t.notaGabunganId, t.statusBayar),
}));

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
