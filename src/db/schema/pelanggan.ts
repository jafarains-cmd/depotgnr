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
    tipe: text("tipe", {
      enum: ["umum", "langganan_pending", "langganan", "langganan_ditolak"],
    })
      .notNull()
      .default("umum"),
    // KTP untuk verifikasi langganan (peminjaman galon depot).
    // ktpFotoUrl = URL Drive (via Apps Script uploader), bukan blob di DB.
    ktpFotoUrl: text("ktp_foto_url"),
    ktpUploadedAt: integer("ktp_uploaded_at", { mode: "timestamp" }),
    ktpVerifiedAt: integer("ktp_verified_at", { mode: "timestamp" }),
    ktpVerifiedBy: text("ktp_verified_by").references(() => user.id, { onDelete: "set null" }),
    ktpDitolakAlasan: text("ktp_ditolak_alasan"),
    // Override limit galon per pelanggan (null = pakai global setting default_limit_galon_langganan).
    limitGalon: integer("limit_galon"),
    catatan: text("catatan"),
    // Loyalty + referral
    saldoLoyalti: integer("saldo_loyalti").notNull().default(0),
    kodeReferral: text("kode_referral").unique(),
    referredBy: integer("referred_by"),
    // Staff yang ajak (kasir/admin) — tracking untuk bonus_referral_staff
    referredByUserId: text("referred_by_user_id"),
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

export const galonPelanggan = sqliteTable(
  "galon_pelanggan",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pelangganId: integer("pelanggan_id")
      .notNull()
      .references(() => pelanggan.id, { onDelete: "cascade" }),
    produkId: integer("produk_id").notNull(),
    jumlahDititip: integer("jumlah_dititip").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => ({
    pelangganProdukIdx: index("galon_pelanggan_pelanggan_produk_idx").on(
      t.pelangganId,
      t.produkId,
    ),
  }),
);

/**
 * History tiap perubahan titipan galon (masuk/keluar). Untuk audit trail
 * supaya admin tahu siapa adjust kapan dan kenapa.
 */
export const mutasiTitipan = sqliteTable(
  "mutasi_titipan",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pelangganId: integer("pelanggan_id")
      .notNull()
      .references(() => pelanggan.id, { onDelete: "cascade" }),
    produkId: integer("produk_id").notNull(),
    perubahan: integer("perubahan").notNull(), // positif=masuk titip, negatif=kembalikan
    alasan: text("alasan").notNull(),
    refOrderId: integer("ref_order_id"),
    catatan: text("catatan"),
    userId: text("user_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    pelangganDateIdx: index("mutasi_titipan_pelanggan_date_idx").on(
      t.pelangganId,
      t.createdAt,
    ),
  }),
);

/**
 * Saldo running galon DEPOT yang sedang dipegang pelanggan (kebalikan dari
 * galonPelanggan/titipan). Auto-increment lewat catatMutasiGalonPinjam.
 */
export const galonDipinjam = sqliteTable(
  "galon_dipinjam",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pelangganId: integer("pelanggan_id")
      .notNull()
      .references(() => pelanggan.id, { onDelete: "cascade" }),
    produkId: integer("produk_id").notNull(),
    jumlah: integer("jumlah").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    pelangganProdukIdx: index("galon_dipinjam_pelanggan_produk_idx").on(
      t.pelangganId,
      t.produkId,
    ),
  }),
);

/**
 * Audit trail tiap perubahan galon dipinjam.
 * Kolom `galonSerial` reserved untuk fitur QR/nomor unik fisik galon (nullable
 * sekarang, akan diisi saat fitur tersebut diimplement).
 */
export const mutasiGalonPinjam = sqliteTable(
  "mutasi_galon_pinjam",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pelangganId: integer("pelanggan_id")
      .notNull()
      .references(() => pelanggan.id, { onDelete: "cascade" }),
    produkId: integer("produk_id").notNull(),
    perubahan: integer("perubahan").notNull(), // + pinjam (galon depot keluar), - kembali (galon depot masuk)
    tipe: text("tipe", { enum: ["pinjam", "kembali", "adjust", "reverse"] }).notNull(),
    alasan: text("alasan"),
    refTransaksiId: integer("ref_transaksi_id"),
    refOrderId: integer("ref_order_id"),
    galonSerial: text("galon_serial"), // reserved untuk fitur QR/nomor unik nanti
    userId: text("user_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    pelangganDateIdx: index("mutasi_galon_pinjam_pelanggan_date_idx").on(
      t.pelangganId,
      t.createdAt,
    ),
    refTrxIdx: index("mutasi_galon_pinjam_ref_trx_idx").on(t.refTransaksiId),
    refOrderIdx: index("mutasi_galon_pinjam_ref_order_idx").on(t.refOrderId),
  }),
);

export type Pelanggan = typeof pelanggan.$inferSelect;
export type NewPelanggan = typeof pelanggan.$inferInsert;
export type GalonPelanggan = typeof galonPelanggan.$inferSelect;
export type MutasiTitipan = typeof mutasiTitipan.$inferSelect;
export type GalonDipinjam = typeof galonDipinjam.$inferSelect;
export type MutasiGalonPinjam = typeof mutasiGalonPinjam.$inferSelect;
