import { test, expect, authFile } from "./helpers";

/**
 * Skenario 8: MOBILE & RESPONSIF
 * Hanya run di project: mobile (Pixel 5 emulation).
 */

test.describe("08 - Mobile (Pixel 5)", () => {
  test("8.0 Login page mobile-friendly", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder(/email \/ username/)).toBeVisible();
    // Tombol submit harus visible (tidak terpotong)
    await expect(page.getByRole("button", { name: /^Masuk$/i })).toBeVisible();
  });

  test("8.1 Admin: hamburger drawer ada di mobile", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin") });
    const page = await ctx.newPage();
    await page.goto("/admin/dashboard");
    // Drawer trigger (svg menu)
    const drawer = page.locator("[aria-label*='menu' i], button:has(svg)").first();
    await expect(drawer).toBeVisible();
    await ctx.close();
  });

  test("8.2 POS mobile: form tetap usable", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("kasir") });
    const page = await ctx.newPage();
    await page.goto("/kasir/pos");
    expect(page.url()).not.toContain("/login");
    // Tombol simpan tetap terjangkau (mungkin scroll)
    await expect(page.getByRole("button", { name: /Simpan/i }).first()).toBeVisible();
    await ctx.close();
  });

  test("8.3 Tabel di list admin scrollable horizontal", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin") });
    const page = await ctx.newPage();
    await page.goto("/admin/users");
    // overflow-x-auto wrapper di sekitar table
    const scrollable = page.locator(".overflow-x-auto, [class*='overflow-x-auto']").first();
    await expect(scrollable).toBeVisible();
    await ctx.close();
  });
});
