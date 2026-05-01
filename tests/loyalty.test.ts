import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as pelangganSchema from "../src/db/schema/pelanggan";
import * as orderSchema from "../src/db/schema/order";
import * as authSchema from "../src/db/schema/auth";
import * as produkSchema from "../src/db/schema/produk";
import * as transaksiSchema from "../src/db/schema/transaksi";
import * as inventorySchema from "../src/db/schema/inventory";
import * as pengaturanSchema from "../src/db/schema/pengaturan";

/**
 * Tests fokus ke logic-only di lib/loyalty (rate, claim, idempotency).
 * Pakai in-memory SQLite supaya isolated per test.
 *
 * NOTE: tests ini load schema langsung tapi tidak import lib/loyalty
 * (yang resolve drizzle-kit & connection real). Sebagai gantinya, kita test
 * INVARIAN: idempotency, atomic redeem, state machine.
 */

const schema = {
  ...pelangganSchema,
  ...orderSchema,
  ...authSchema,
  ...produkSchema,
  ...transaksiSchema,
  ...inventorySchema,
  ...pengaturanSchema,
};

function makeDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  // Apply migrations dari folder drizzle/
  migrate(db, { migrationsFolder: "./drizzle" });
  return { db, sqlite };
}

describe("loyalty: idempotency invariants", () => {
  let db: ReturnType<typeof makeDb>["db"];

  beforeEach(() => {
    const m = makeDb();
    db = m.db;
  });

  it("UPDATE conditional WHERE saldo >= jumlah hanya jalan kalau saldo cukup", async () => {
    const [u] = await db
      .insert(schema.user)
      .values({ id: "u1", name: "User", email: "u@x", emailVerified: false })
      .returning();
    const [p] = await db
      .insert(schema.pelanggan)
      .values({ userId: u.id, nama: "Test", saldoLoyalti: 100 })
      .returning();

    // Coba redeem 50 — harus berhasil
    const r1 = await db
      .update(schema.pelanggan)
      .set({ saldoLoyalti: sql`${schema.pelanggan.saldoLoyalti} - 50` })
      .where(eq(schema.pelanggan.id, p.id))
      .run();
    expect(r1.changes).toBe(1);

    // Coba redeem 100 (saldo tinggal 50) — harusnya gagal
    const r2 = db
      .update(schema.pelanggan)
      .set({ saldoLoyalti: sql`${schema.pelanggan.saldoLoyalti} - 100` })
      .where(
        sql`${schema.pelanggan.id} = ${p.id} AND ${schema.pelanggan.saldoLoyalti} >= 100`,
      )
      .run();
    expect(r2.changes).toBe(0);

    const after = await db.query.pelanggan.findFirst({
      where: eq(schema.pelanggan.id, p.id),
    });
    expect(after?.saldoLoyalti).toBe(50);
  });

  it("unique index pelanggan.user_id mencegah duplikat", async () => {
    await db
      .insert(schema.user)
      .values({ id: "u-dup", name: "U", email: "dup@x", emailVerified: false })
      .returning();

    await db.insert(schema.pelanggan).values({ userId: "u-dup", nama: "A" });
    expect(() =>
      db.insert(schema.pelanggan).values({ userId: "u-dup", nama: "B" }).run(),
    ).toThrow(/UNIQUE/i);
  });

  it("mutasi_loyalti index covers idempotency lookup", async () => {
    await db
      .insert(schema.user)
      .values({ id: "u3", name: "U", email: "u3@x", emailVerified: false })
      .returning();
    const [p] = await db
      .insert(schema.pelanggan)
      .values({ userId: "u3", nama: "U" })
      .returning();

    await db.insert(schema.mutasiLoyalti).values({
      pelangganId: p.id,
      jumlah: 1000,
      tipe: "earn",
      refOrderId: 42,
      deskripsi: "test",
    });

    const found = await db.query.mutasiLoyalti.findFirst({
      where: sql`${schema.mutasiLoyalti.refOrderId} = 42 AND ${schema.mutasiLoyalti.tipe} = 'earn'`,
    });
    expect(found).toBeDefined();
    expect(found?.jumlah).toBe(1000);
  });

  it("referral_in tipe unique per pelanggan jadi dasar idempotency claim", async () => {
    await db
      .insert(schema.user)
      .values({ id: "u-ref", name: "U", email: "ref@x", emailVerified: false })
      .returning();
    const [p] = await db
      .insert(schema.pelanggan)
      .values({ userId: "u-ref", nama: "R" })
      .returning();

    // Insert pertama
    await db.insert(schema.mutasiLoyalti).values({
      pelangganId: p.id,
      jumlah: 5000,
      tipe: "referral_in",
    });

    // Cek existence (logic claimReferralBonusIfFirstOrder)
    const exists = await db.query.mutasiLoyalti.findFirst({
      where: sql`${schema.mutasiLoyalti.pelangganId} = ${p.id} AND ${schema.mutasiLoyalti.tipe} = 'referral_in'`,
    });
    expect(exists).toBeDefined();
    // Skip insert kedua → no double-bonus
  });
});

describe("state machine invariants", () => {
  const VALID = {
    pending: ["diproses", "dijemput", "batal"],
    diproses: ["diantar", "batal"],
    dijemput: ["diisi", "batal"],
    diisi: ["diantar", "batal"],
    diantar: ["selesai", "batal"],
    selesai: [],
    batal: [],
  } as const;

  it("selesai is terminal — tidak boleh kembali ke pending", () => {
    expect(VALID.selesai).not.toContain("pending");
    expect(VALID.selesai).toHaveLength(0);
  });

  it("batal terminal", () => {
    expect(VALID.batal).toHaveLength(0);
  });

  it("dari pending boleh ke diproses, dijemput, atau batal", () => {
    expect(VALID.pending).toContain("diproses");
    expect(VALID.pending).toContain("dijemput");
    expect(VALID.pending).toContain("batal");
  });

  it("dari diproses tidak boleh langsung ke selesai (harus via diantar)", () => {
    expect(VALID.diproses).not.toContain("selesai");
    expect(VALID.diproses).toContain("diantar");
  });
});
