import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const pelanggan = sqliteTable("pelanggan", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  nama: text("nama").notNull(),
  telp: text("telp"),
  alamat: text("alamat"),
  koordinatLat: real("koordinat_lat"),
  koordinatLng: real("koordinat_lng"),
  tipe: text("tipe", { enum: ["umum", "langganan"] }).notNull().default("umum"),
  catatan: text("catatan"),
  // Loyalty + referral
  saldoLoyalti: integer("saldo_loyalti").notNull().default(0),
  kodeReferral: text("kode_referral").unique(),
  referredBy: integer("referred_by"),
  firstOrderRewardClaimed: integer("first_order_reward_claimed", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const mutasiLoyalti = sqliteTable("mutasi_loyalti", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pelangganId: integer("pelanggan_id")
    .notNull()
    .references(() => pelanggan.id, { onDelete: "cascade" }),
  jumlah: integer("jumlah").notNull(), // positif=earn/bonus, negatif=redeem
  tipe: text("tipe", {
    enum: ["earn", "redeem", "referral_in", "referral_bonus", "adjust"],
  }).notNull(),
  refOrderId: integer("ref_order_id"),
  refTransaksiId: integer("ref_transaksi_id"),
  deskripsi: text("deskripsi"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const galonPelanggan = sqliteTable("galon_pelanggan", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pelangganId: integer("pelanggan_id")
    .notNull()
    .references(() => pelanggan.id, { onDelete: "cascade" }),
  produkId: integer("produk_id").notNull(),
  jumlahDititip: integer("jumlah_dititip").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type Pelanggan = typeof pelanggan.$inferSelect;
export type NewPelanggan = typeof pelanggan.$inferInsert;
