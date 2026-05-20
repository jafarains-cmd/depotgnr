import { chromium, type FullConfig } from "@playwright/test";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { TEST_USERS, authFile, type Role } from "./helpers";

const BASE_URL = "http://localhost:3000";
const DB_PATH = process.env.DATABASE_URL ?? "./data/depot.db";

/**
 * Global setup:
 * 1. Verifikasi dev server hidup
 * 2. Pastikan admin@depot.local ada (idempotent)
 * 3. Seed 3 akun test (kasir/kurir/pelanggan) via Better Auth sign-up + update role
 * 4. Login tiap role via UI → simpan storageState ke tests/e2e/.auth/<role>.json
 */
export default async function globalSetup(_config: FullConfig) {
  console.log("\n[e2e] Global setup mulai...");

  // 1. Cek dev server
  const ok = await fetch(BASE_URL).then((r) => r.ok).catch(() => false);
  if (!ok) {
    throw new Error(`Dev server tidak merespons di ${BASE_URL}. Jalankan: npm run dev`);
  }
  console.log("[e2e] Dev server OK");

  // 2. Buka DB untuk verifikasi + role update
  const db = new Database(DB_PATH);

  // 3. Pastikan admin ada
  await ensureUser(db, "admin");
  // 4. Seed 3 akun staff
  await ensureUser(db, "kasir");
  await ensureUser(db, "kurir");
  await ensureUser(db, "pelanggan");

  db.close();

  // 5. Pastikan folder .auth ada
  const authDir = path.resolve("tests/e2e/.auth");
  fs.mkdirSync(authDir, { recursive: true });

  // 6. Login tiap role via UI, simpan storage state
  const browser = await chromium.launch();
  for (const role of ["admin", "kasir", "kurir", "pelanggan"] as Role[]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const u = TEST_USERS[role];
    console.log(`[e2e] Login as ${role} (${u.email})...`);
    await page.goto(`${BASE_URL}/login`);
    await page.getByPlaceholder(/email \/ username/).fill(u.email);
    await page.locator('input[type="password"]').fill(u.password);
    await page.getByRole("button", { name: /^Masuk$/i }).click();
    try {
      await page.waitForURL((url) => !/\/login/.test(url.toString()), { timeout: 15_000 });
    } catch {
      const err = await page.locator("text=/gagal|invalid|tidak/i").textContent().catch(() => null);
      throw new Error(`Login ${role} gagal. URL: ${page.url()} ${err ? `Pesan: ${err}` : ""}`);
    }
    await context.storageState({ path: authFile(role) });
    console.log(`[e2e]   storage state disimpan: ${authFile(role)}`);
    await context.close();
  }
  await browser.close();

  console.log("[e2e] Global setup selesai.\n");
}

async function ensureUser(db: Database.Database, role: Role) {
  const u = TEST_USERS[role];
  const existing = db.prepare("SELECT id, role FROM user WHERE email = ?").get(u.email) as
    | { id: string; role: string }
    | undefined;

  if (existing) {
    if (existing.role !== role) {
      db.prepare("UPDATE user SET role = ? WHERE id = ?").run(role, existing.id);
      console.log(`[e2e]   role ${u.email}: ${existing.role} → ${role}`);
    } else {
      console.log(`[e2e]   ${u.email} sudah ada (role: ${role})`);
    }
    return;
  }

  // Sign up via API (Better Auth butuh Origin header)
  const res = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE_URL,
    },
    body: JSON.stringify({ name: u.name, email: u.email, password: u.password }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Sign-up ${u.email} gagal: ${res.status} ${t.slice(0, 200)}`);
  }
  console.log(`[e2e]   created ${u.email}`);
  // Set role
  db.prepare("UPDATE user SET role = ? WHERE email = ?").run(role, u.email);
}
