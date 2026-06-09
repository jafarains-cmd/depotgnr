import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

/**
 * Kode referral per staff (kasir/admin/kurir) untuk track siapa yang
 * berhasil mengajak pelanggan baru daftar. Mirror dari pelanggan.kodeReferral.
 */
export const staffReferral = sqliteTable("staff_referral", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  kode: text("kode").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Bonus referral staff. 1 baris = 1 pelanggan baru yang berhasil di-ajak
 * dan SUDAH ORDER PERTAMA (aktif). Default status="pending", owner bayar
 * manual via /admin/bonus-staff.
 *
 * Idempoten: cek pelangganId — 1 pelanggan = 1 bonus untuk 1 staff.
 */
export const bonusReferralStaff = sqliteTable(
  "bonus_referral_staff",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    staffUserId: text("staff_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    pelangganId: integer("pelanggan_id").notNull(),
    nominal: integer("nominal").notNull(),
    status: text("status", { enum: ["pending", "dibayar"] }).notNull().default("pending"),
    paidAt: integer("paid_at", { mode: "timestamp" }),
    paidBy: text("paid_by").references(() => user.id, { onDelete: "set null" }),
    catatan: text("catatan"),
    refTransaksiId: integer("ref_transaksi_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    staffStatusIdx: index("bonus_referral_staff_staff_status_idx").on(
      t.staffUserId,
      t.status,
    ),
    pelangganIdx: index("bonus_referral_staff_pelanggan_idx").on(t.pelangganId),
  }),
);

export type StaffReferral = typeof staffReferral.$inferSelect;
export type BonusReferralStaff = typeof bonusReferralStaff.$inferSelect;
