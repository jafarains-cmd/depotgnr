import { test, expect, authFile } from "./helpers";

/**
 * Skenario 6: STOK & PRODUK
 * Smoke: halaman produk + inventory admin render.
 */

test.use({ storageState: authFile("admin") });

test.describe("06 - Stok & Produk", () => {
  test("6.0 Halaman /admin/produk render", async ({ page }) => {
    await page.goto("/admin/produk");
    expect(page.url()).not.toContain("/login");
    await expect(page.locator("body")).toContainText(/produk|harga/i);
  });

  test("6.1 Halaman /admin/inventory render", async ({ page }) => {
    await page.goto("/admin/inventory");
    expect(page.url()).not.toContain("/login");
    await expect(page.locator("body")).toContainText(/stok|inventory|galon/i);
  });

  test.fixme("6.2 Stok turun setelah POS — perlu setup produk uji", () => {});
});
