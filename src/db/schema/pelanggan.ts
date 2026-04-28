import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const pelanggan = sqliteTable("pelanggan", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  nama: text("nama").notNull(),
  telp: text("telp"),
  alamat: text("alamat"),
  koordinatLat: real("koordinat_lat"),
  koordinatLng: real("koordinat_lng"),
  tipe: text("tipe", { enum: ["umum", "langganan"] }).notNull().default("umum"),
  catatan: text("catatan"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const galonPelanggan = sqliteTable("galon_pelanggan", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pelangganId: integer("pelanggan_id")
    .notNull()
    .references(() => pelanggan.id, { onDelete: "cascade" }),
  produkId: integer("produk_id").notNull(),
  jumlahDititip: integer("jumlah_dititip").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type Pelanggan = typeof pelanggan.$inferSelect;
export type NewPelanggan = typeof pelanggan.$inferInsert;
