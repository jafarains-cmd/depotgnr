import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

/**
 * Token reset password — 3 jalur:
 *   - wa_otp: OTP 6 digit dikirim via WhatsApp
 *   - email: link 32-char token dikirim via email
 *   - admin: link 32-char token di-generate manual oleh admin (kasih ke user
 *     via channel apapun)
 *
 * Multi-record per user dibolehkan (user bisa request berulang) tapi rate
 * limit di server. Token sekali pakai (usedAt diset).
 */
export const passwordReset = sqliteTable(
  "password_reset",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    method: text("method", { enum: ["wa_otp", "email", "admin"] }).notNull(),
    token: text("token").notNull().unique(), // OTP code atau random hex
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp" }),
    createdByUserId: text("created_by_user_id"), // untuk admin-generated
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userMethodIdx: index("password_reset_user_method_idx").on(t.userId, t.method),
    expiresIdx: index("password_reset_expires_idx").on(t.expiresAt),
  }),
);

export type PasswordReset = typeof passwordReset.$inferSelect;
