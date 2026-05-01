import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const pelanggan = sqliteTable(
  "pelanggan",
  {
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
    // Stamp galon: counter total galon yang sudah dibeli; setiap N (default 10) → reward
    stampGalon: integer("stamp_galon").notNull().default(0),
    stampClaimedCount: integer("stamp_claimed_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => ({
    // 1 user = 1 pelanggan (cegah duplikat saat race di getOrCreatePelanggan)
    userIdUnique: uniqueIndex("pelanggan_user_id_unique").on(t.userId),
  }),
);

export const mutasiLoyalti = sqliteTable(
  "mutasi_loyalti",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pelangganId: integer("pelanggan_id")
      .notNull()
      .references(() => pelanggan.id, { onDelete: "cascade" }),
    jumlah: integer("jumlah").notNull(), // positif=earn/bonus, negatif=redeem
    tipe: text("tipe", {
      enum: ["earn", "redeem", "referral_in", "referral_bonus", "stamp_reward", "adjust"],
    }).notNull(),
    refOrderId: integer("ref_order_id"),
    refTransaksiId: integer("ref_transaksi_id"),
    deskripsi: text("deskripsi"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => ({
    // History per pelanggan
    pelangganDateIdx: index("mutasi_loyalti_pelanggan_date_idx").on(t.pelangganId, t.createdAt),
    // Idempotency check earnLoyalty (refOrderId + tipe earn)
    refOrderTipeIdx: index("mutasi_loyalti_ref_order_tipe_idx").on(t.refOrderId, t.tipe),
    refTrxTipeIdx: index("mutasi_loyalti_ref_trx_tipe_idx").on(t.refTransaksiId, t.tipe),
  }),
);

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
