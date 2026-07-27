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
    selisihKategori: text("selisih_kategori"), // wajib kalau selisih != 0
    selisihAlasan: text("selisih_alasan"), // penjelasan kasir
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
    // Track terakhir kali notif "lupa tutup shift" dikirim (idempotency: kirim
    // ulang hanya tiap 6 jam supaya tidak spam).
    staleNotifSentAt: integer("stale_notif_sent_at", { mode: "timestamp" }),

    // ═══════════════════════════════════════════════════════════
    // HANDOVER (serah-terima uang antar kasir)
    // Diisi saat tutup shift kalau uang diserahkan ke kasir berikut
    // (bukan disetor sendiri / ditinggal untuk diambil owner).
    // ═══════════════════════════════════════════════════════════
    handoverAmount: integer("handover_amount"), // Rupiah, null = tidak ada handover
    handoverToKasirUserId: text("handover_to_kasir_user_id").references(
      () => user.id,
      { onDelete: "set null" },
    ),
    handoverFotoUrl: text("handover_foto_url"),
    handoverCatatan: text("handover_catatan"),

    // Saat buka shift dari handover: link ke shift asal + track kalau
    // opening lebih besar dari handover (ada setoran tambahan owner).
    openingFromShiftId: integer("opening_from_shift_id"),
    openingExtraAmount: integer("opening_extra_amount").notNull().default(0),
    openingExtraSource: text("opening_extra_source"), // setoran-owner|sisa-cash|kas-masuk-lain|lainnya
    openingExtraCatatan: text("opening_extra_catatan"),
  },
  (t) => ({
    kasirStatusIdx: index("shift_kasir_kasir_status_idx").on(t.kasirUserId, t.status),
    statusIdx: index("shift_kasir_status_idx").on(t.status, t.openedAt),
  }),
);

export type ShiftKasir = typeof shiftKasir.$inferSelect;
