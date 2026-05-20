import { test, expect, authFile } from "./helpers";

/**
 * Skenario 1: AUTH & ROLE
 * Verifikasi login berhasil per role, akses halaman sesuai role,
 * dan logout berfungsi. Skip skenario yang butuh service eksternal.
 */

test.describe("01 - Auth & Role", () => {
  test("1.1.a Admin bisa akses /admin/dashboard", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin") });
    const page = await ctx.newPage();
    await page.goto("/admin/dashboard");
    expect(page.url()).not.toContain("/login");
    await expect(page.locator("body")).toContainText(/dashboard|laporan|order|pelanggan/i);
    await ctx.close();
  });

  test("1.1.b Kasir bisa akses /kasir/pos", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("kasir") });
    const page = await ctx.newPage();
    await page.goto("/kasir/pos");
    expect(page.url()).not.toContain("/login");
    await expect(page.locator("body")).toContainText(/POS|Kasir|Keranjang|Produk/i);
    await ctx.close();
  });

  test("1.1.c Kurir bisa akses /kurir", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("kurir") });
    const page = await ctx.newPage();
    await page.goto("/kurir");
    expect(page.url()).not.toContain("/login");
    await expect(page.locator("body")).toContainText(/order|antrian|hari ini|kurir/i);
    await ctx.close();
  });

  test("1.1.d Pelanggan bisa akses /pelanggan/beranda", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("pelanggan") });
    const page = await ctx.newPage();
    await page.goto("/pelanggan/beranda");
    expect(page.url()).not.toContain("/login");
    await ctx.close();
  });

  test("1.1.e Kurir TIDAK boleh akses /admin/users → 403/redirect", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("kurir") });
    const page = await ctx.newPage();
    await page.goto("/admin/users");
    const body = await page.locator("body").textContent();
    const blocked =
      page.url().includes("/login") ||
      page.url() === "http://localhost:3000/" ||
      page.url().includes("/kurir") ||
      /403|akses ditolak|forbidden|unauthorized/i.test(body ?? "");
    expect(blocked).toBeTruthy();
    await ctx.close();
  });

  test("1.1.f Pelanggan TIDAK boleh akses /admin/dashboard → 403/redirect", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: authFile("pelanggan") });
    const page = await ctx.newPage();
    await page.goto("/admin/dashboard");
    const body = await page.locator("body").textContent();
    const blocked =
      page.url().includes("/login") ||
      page.url().includes("/pelanggan") ||
      page.url() === "http://localhost:3000/" ||
      /403|akses ditolak|forbidden|unauthorized/i.test(body ?? "");
    expect(blocked).toBeTruthy();
    await ctx.close();
  });

  test("1.2 Login form reject password salah", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder(/email \/ username/).fill("admin@depot.local");
    await page.locator('input[type="password"]').fill("WRONG_PASSWORD_xx");
    await page.getByRole("button", { name: /^Masuk$/i }).click();
    // Expect error message muncul, atau tetap di /login
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/login");
  });

  test.skip("1.3 Lupa password WA/Email — butuh service eksternal", () => {});
  test.skip("1.4 Register via WA OTP — butuh OTP real", () => {});
});
