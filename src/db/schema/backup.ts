import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const backupLog = sqliteTable(
  "backup_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ranAt: integer("ran_at", { mode: "timestamp" }).notNull(),
    status: text("status", { enum: ["success", "failed"] }).notNull(),
    sizeBytes: integer("size_bytes"),
    fileUrl: text("file_url"),
    fileId: text("file_id"),
    error: text("error"),
    durationMs: integer("duration_ms"),
    triggeredBy: text("triggered_by", { enum: ["manual", "cron"] }).notNull(),
    triggeredByUserId: text("triggered_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (t) => ({
    ranAtIdx: index("backup_log_ran_at_idx").on(t.ranAt),
  }),
);

export type BackupLog = typeof backupLog.$inferSelect;
