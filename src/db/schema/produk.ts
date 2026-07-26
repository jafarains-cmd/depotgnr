import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const produk = sqliteTable("produk", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nama: text("nama").notNull(),
  deskripsi: text("deskripsi"),
  hargaIsiUlang: integer("harga_isi_ulang").notNull().default(0),
  hargaTukar: integer("harga_tukar").notNull().default(0),
  hargaBeliBaru: integer("harga_beli_baru").notNull().default(0),
  // Harga pokok (cost) untuk kalkulasi laba. Auto-update saat catat
  // pembelian galon (ambil hargaSatuan terakhir).
  hargaPokok: integer("harga_pokok").notNull().default(0),
  // Brand galon (mis. "AQUA", "Le Minerale"). Null = brand depot sendiri.
  brand: text("brand"),
  aktif: integer("aktif", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type Produk = typeof produk.$inferSelect;
export type NewProduk = typeof produk.$inferInsert;
