import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

/**
 * Bonus per pengantaran kurir. 1 baris = 1 order yang diantar.
 *  - status pending: kurir sudah antar, belum dibayar owner
 *  - status dibayar: owner sudah bayar (manual via /admin/bonus-kurir)
 */
export const bonusKurir = sqliteTable(
  "bonus_kurir",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kurirUserId: text("kurir_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    orderId: integer("order_id").notNull(),
    jumlahGalon: integer("jumlah_galon").notNull(),
    ratePerGalon: integer("rate_per_galon").notNull(),
    total: integer("total").notNull(),
    // Partial payment: berapa rupiah yang sudah dibayar dari `total`. Untuk
    // dukung pembayaran "uang pas". Kalau paidPartial < total → status tetap
    // pending dengan saldo (total - paidPartial). Saat paidPartial = total →
    // status berubah ke dibayar.
    paidPartial: integer("paid_partial").notNull().default(0),
    status: text("status", { enum: ["pending", "dibayar"] }).notNull().default("pending"),
    paidAt: integer("paid_at", { mode: "timestamp" }),
    paidBy: text("paid_by").references(() => user.id, { onDelete: "set null" }),
    catatan: text("catatan"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    // Cegah duplikat bonus untuk order yang sama
    orderUnique: index("bonus_kurir_order_unique_idx").on(t.orderId),
    kurirStatusIdx: index("bonus_kurir_kurir_status_idx").on(t.kurirUserId, t.status),
    kurirDateIdx: index("bonus_kurir_kurir_date_idx").on(t.kurirUserId, t.createdAt),
  }),
);

export type BonusKurir = typeof bonusKurir.$inferSelect;
