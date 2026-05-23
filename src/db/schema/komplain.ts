import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { pelanggan } from "./pelanggan";
import { user } from "./auth";

/**
 * Komplain pelanggan terhadap produk/order. Workflow:
 *   baru → diproses → selesai (atau ditolak)
 * Saat resolve, admin bisa kasih kompensasi loyalty + catat resolusi.
 */
export const komplain = sqliteTable(
  "komplain",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pelangganId: integer("pelanggan_id")
      .notNull()
      .references(() => pelanggan.id, { onDelete: "cascade" }),
    refOrderId: integer("ref_order_id"),
    jenis: text("jenis", {
      enum: ["kotor", "rusak", "kurang_volume", "salah_pesanan", "lainnya"],
    }).notNull(),
    deskripsi: text("deskripsi").notNull(),
    fotoUrl: text("foto_url"),
    status: text("status", { enum: ["baru", "diproses", "selesai", "ditolak"] })
      .notNull()
      .default("baru"),
    resolusi: text("resolusi"),
    kompensasiLoyalti: integer("kompensasi_loyalti").notNull().default(0),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    resolvedBy: text("resolved_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    statusIdx: index("komplain_status_idx").on(t.status),
    pelangganDateIdx: index("komplain_pelanggan_date_idx").on(t.pelangganId, t.createdAt),
  }),
);

export type Komplain = typeof komplain.$inferSelect;

/**
 * Thread pesan untuk tiap komplain — chat 2-arah antara pelanggan & admin.
 * Bisa lampirkan foto opsional. Tidak ada delete: append-only untuk audit.
 */
export const komplainPesan = sqliteTable(
  "komplain_pesan",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    komplainId: integer("komplain_id")
      .notNull()
      .references(() => komplain.id, { onDelete: "cascade" }),
    /** Author role: pelanggan vs admin/kasir. Sumber user dari user.id */
    senderUserId: text("sender_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    senderRole: text("sender_role", { enum: ["pelanggan", "staff"] }).notNull(),
    pesan: text("pesan").notNull(),
    fotoUrl: text("foto_url"),
    /** Tanda admin sudah baca pesan pelanggan, atau sebaliknya */
    readByOther: integer("read_by_other", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    komplainDateIdx: index("komplain_pesan_komplain_date_idx").on(
      t.komplainId,
      t.createdAt,
    ),
  }),
);

export type KomplainPesan = typeof komplainPesan.$inferSelect;
