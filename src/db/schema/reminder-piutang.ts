import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { orderHeader } from "./order";

/**
 * Log reminder piutang. Setiap kali admin klik "Sudah Dikirim" di
 * dashboard reminder, insert 1 record.
 *
 * Stage 1 = H+7 (sopan)
 * Stage 2 = H+14 (tegas)
 * Stage 3 = H+30 (last warning)
 *
 * Setelah stage 3 → stop auto-reminder, muncul flag di dashboard
 * "Perlu follow-up manual" untuk admin escalate.
 */
export const reminderPiutang = sqliteTable(
  "reminder_piutang",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orderHeader.id, { onDelete: "cascade" }),
    stage: integer("stage").notNull(), // 1, 2, atau 3
    channel: text("channel", { enum: ["wa-manual", "wa-auto", "telegram"] })
      .notNull()
      .default("wa-manual"),
    sentAt: integer("sent_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    sentBy: text("sent_by").references(() => user.id, { onDelete: "set null" }),
    catatan: text("catatan"),
  },
  (t) => ({
    orderIdx: index("reminder_piutang_order_idx").on(t.orderId),
    stageIdx: index("reminder_piutang_stage_idx").on(t.stage, t.sentAt),
  }),
);

export type ReminderPiutang = typeof reminderPiutang.$inferSelect;
export type NewReminderPiutang = typeof reminderPiutang.$inferInsert;
