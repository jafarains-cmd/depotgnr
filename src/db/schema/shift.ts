import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

/**
 * Shift kasir — penanda periode kerja seorang kasir.
 *
 * Pola pakai:
 *  - Kasir buka shift saat mulai kerja (input opening cash opsional)
 *  - Semua transaksi/order/pengeluaran selama shift di-link via shiftId
 *  - Tutup shift saat selesai (input closing cash, sistem hitung selisih)
 *  - Reopen kalau salah tutup (window 30 menit, dicatat di reopened_at)
 *  - Take-over: kasir lain bisa input atas nama shift (kasir formal tetap),
 *    transaksi.kasirUserId = aktor sebenarnya
 *
 * Multiple shift open di sistem bersamaan diizinkan (kasir berbeda) +
 * 1 kasir bisa punya beberapa shift dalam 1 hari (open shift baru setelah
 * tutup yang lama).
 */
export const shiftKasir = sqliteTable(
  "shift_kasir",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kasirUserId: text("kasir_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    openingCash: integer("opening_cash"), // opsional, null = skip hitung uang awal
    closingCashCounted: integer("closing_cash_counted"), // diisi saat tutup
    closingCashExpected: integer("closing_cash_expected"), // snapshot computed saat tutup
    selisih: integer("selisih"), // counted - expected (- = kurang, + = lebih)
    catatan: text("catatan"),
    buktiFotoUrl: text("bukti_foto_url"),
    status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
    openedAt: integer("opened_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    closedAt: integer("closed_at", { mode: "timestamp" }),
    closedByUserId: text("closed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reopenedAt: integer("reopened_at", { mode: "timestamp" }),
    reopenedByUserId: text("reopened_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (t) => ({
    kasirStatusIdx: index("shift_kasir_kasir_status_idx").on(t.kasirUserId, t.status),
    statusIdx: index("shift_kasir_status_idx").on(t.status, t.openedAt),
  }),
);

export type ShiftKasir = typeof shiftKasir.$inferSelect;
