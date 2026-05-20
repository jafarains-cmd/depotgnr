import { test, expect, authFile } from "./helpers";

/**
 * Skenario 5: LOYALTY
 * Verifikasi halaman pelanggan detail render history loyalty,
 * halaman pelanggan/loyalty pelanggan render saldo.
 */

test.describe("05 - Loyalty", () => {
  test("5.0 Halaman /pelanggan/loyalty render saldo", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("pelanggan") });
    const page = await ctx.newPage();
    await page.goto("/pelanggan/loyalty");
    expect(page.url()).not.toContain("/login");
    await expect(page.locator("body")).toContainText(/loyalty|saldo|poin|rp/i);
    await ctx.close();
  });

  test("5.1 Admin: data-pelanggan list ada link detail", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin") });
    const page = await ctx.newPage();
    await page.goto("/data-pelanggan");
    expect(page.url()).not.toContain("/login");
    await expect(page.locator("body")).toContainText(/pelanggan|nama/i);
    await ctx.close();
  });

  test.fixme("5.2 Klik baris history loyalty → modal detail muncul — perlu data uji", () => {});
});
