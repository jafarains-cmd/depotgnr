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

const dbPath = process.env.DATABASE_URL ?? "./data/depot.db";
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const schema = {
  ...authSchema,
  ...produkSchema,
  ...pelangganSchema,
  ...inventorySchema,
  ...transaksiSchema,
  ...orderSchema,
  ...pengaturanSchema,
};

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
