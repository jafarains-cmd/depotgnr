import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

/**
 * Log semua event login (success + failed) untuk audit + anomaly detection.
 *
 * Dipakai untuk:
 *  - Track failed login berulang (bisa deteksi brute-force meski di-block rate limit)
 *  - Login alert "device baru" — bandingkan IP+userAgent hash vs history user
 *  - Security dashboard: siapa login dari mana, kapan
 */
export const loginEvent = sqliteTable(
  "login_event",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** ID user kalau ada match. Null untuk gagal (username salah). */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /** Username / email yang di-input (untuk track failed dari username salah). */
    identifier: text("identifier").notNull(),
    /** success / failed / rate_limited */
    status: text("status", { enum: ["success", "failed", "rate_limited"] }).notNull(),
    /** IP address dari header (X-Forwarded-For / X-Real-IP). */
    ipAddress: text("ip_address"),
    /** User-Agent browser. */
    userAgent: text("user_agent"),
    /** Hash fingerprint (IP + UA) untuk quick lookup "device baru". */
    fingerprint: text("fingerprint"),
    /** Kalau failed: alasan (misal "wrong_password", "user_banned"). */
    failReason: text("fail_reason"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userIdx: index("login_event_user_idx").on(t.userId, t.createdAt),
    fingerprintIdx: index("login_event_fingerprint_idx").on(t.fingerprint),
    statusIdx: index("login_event_status_idx").on(t.status, t.createdAt),
    identifierIdx: index("login_event_identifier_idx").on(t.identifier, t.createdAt),
  }),
);

export type LoginEvent = typeof loginEvent.$inferSelect;
export type NewLoginEvent = typeof loginEvent.$inferInsert;
