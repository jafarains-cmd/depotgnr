import "dotenv/config";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import * as authSchema from "./schema/auth";
import * as produkSchema from "./schema/produk";
import * as pelangganSchema from "./schema/pelanggan";
import * as inventorySchema from "./schema/inventory";
import * as transaksiSchema from "./schema/transaksi";
import * as orderSchema from "./schema/order";
import * as pengaturanSchema from "./schema/pengaturan";
import * as bonusSchema from "./schema/bonus";
import * as pengeluaranSchema from "./schema/pengeluaran";

const dbPath = process.env.DATABASE_URL ?? "./data/depot.db";
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
// Concurrency: WAL allows multiple readers + 1 writer.
sqlite.pragma("journal_mode = WAL");
// Integrity: enforce FK constraints (off by default in SQLite).
sqlite.pragma("foreign_keys = ON");
// Performance & robustness:
// - synchronous NORMAL: 2-5x faster writes vs FULL, masih durable di WAL mode.
// - busy_timeout: tunggu 5s sebelum throw BUSY (mencegah error saat concurrent write).
// - cache 64MB di RAM untuk hot pages.
// - temp tables di RAM, bukan disk.
sqlite.pragma("synchronous = NORMAL");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("cache_size = -64000");
sqlite.pragma("temp_store = MEMORY");

export const schema = {
  ...authSchema,
  ...produkSchema,
  ...pelangganSchema,
  ...inventorySchema,
  ...transaksiSchema,
  ...orderSchema,
  ...pengaturanSchema,
  ...bonusSchema,
  ...pengeluaranSchema,
};

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
