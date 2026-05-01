import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Key-value config (telegram token, sheet id, template pesan, dll)
export const pengaturan = sqliteTable("pengaturan", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// State session bot chat (untuk wizard order via Telegram/WA)
export const chatSession = sqliteTable("chat_session", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channel: text("channel", { enum: ["telegram", "whatsapp"] }).notNull(),
  chatId: text("chat_id").notNull(),
  state: text("state").notNull().default("idle"),
  data: text("data"), // JSON
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Konflik sync (sheets vs DB)
export const syncConflict = sqliteTable("sync_conflict", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  dbVersion: text("db_version"),
  sheetVersion: text("sheet_version"),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
