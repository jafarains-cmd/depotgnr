import { type Page, expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import path from "path";

export const E2E_PREFIX = "[E2E]";

export const TEST_USERS = {
  admin: {
    email: "admin@depot.local",
    password: "admin123",
    name: "Admin Depot",
  },
  kasir: {
    email: "kasir.e2e@depot.local",
    password: "KasirE2E123!",
    name: "[E2E] Kasir",
  },
  kurir: {
    email: "kurir.e2e@depot.local",
    password: "KurirE2E123!",
    name: "[E2E] Kurir",
  },
  pelanggan: {
    email: "pelanggan.e2e@depot.local",
    password: "PelangganE2E123!",
    name: "[E2E] Pelanggan",
  },
} as const;

export type Role = keyof typeof TEST_USERS;

export function authFile(role: Role): string {
  return path.resolve("tests/e2e/.auth", `${role}.json`);
}

/** Buka koneksi read-only ke DB dev untuk verifikasi side-effect. */
export function openDbRO(): Database.Database {
  const dbPath = process.env.DATABASE_URL ?? "./data/depot.db";
  return new Database(dbPath, { readonly: true });
}

/** Login lewat UI (untuk awal saja, generate storage state). */
export async function loginViaUI(page: Page, role: Role) {
  const u = TEST_USERS[role];
  await page.goto("/login");
  await page.getByPlaceholder(/email \/ username/).fill(u.email);
  await page.locator('input[type="password"]').fill(u.password);
  await page.getByRole("button", { name: /^Masuk$/i }).click();
  await page.waitForURL((url) => !/\/login/.test(url.toString()), { timeout: 10_000 });
}

/** Marker prefix [E2E] supaya bisa dibersihkan. */
export function mark(label: string): string {
  return `${E2E_PREFIX} ${label}`;
}

/** Hitung row di table sesuai filter. */
export function countWhere(
  db: Database.Database,
  table: string,
  whereSql: string = "",
  params: unknown[] = [],
): number {
  const w = whereSql ? `WHERE ${whereSql}` : "";
  const row = db.prepare(`SELECT count(*) as n FROM "${table}" ${w}`).get(...params) as {
    n: number;
  };
  return row?.n ?? 0;
}

/** Logout via klik link Keluar (text varies; cek 'Logout' / 'Keluar'). */
export async function logout(page: Page) {
  // Try common logout button labels
  const logout = page.getByRole("button", { name: /keluar|logout/i }).or(
    page.getByRole("link", { name: /keluar|logout/i }),
  );
  if (await logout.first().isVisible({ timeout: 2000 }).catch(() => false)) {
    await logout.first().click();
    await page.waitForURL(/\/login|\/$/, { timeout: 5_000 }).catch(() => {});
  }
}

/** Cek apakah halaman redirect ke /login (artinya butuh auth). */
export async function isRedirectedToLogin(page: Page): Promise<boolean> {
  return /\/login/.test(page.url());
}

/** Polling sampai network idle (server actions resolved). */
export async function waitForServerAction(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
}

/** Re-export expect+test supaya spec lebih ringkas. */
export { expect, test };
