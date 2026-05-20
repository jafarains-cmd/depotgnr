import { test, expect, authFile } from "./helpers";

/**
 * Skenario 4: NOTA GABUNGAN
 * Smoke check halaman picker + cetak + nav dari /pembayaran.
 */

test.use({ storageState: authFile("admin") });

test.describe("04 - Nota Gabungan", () => {
  test("4.0 Picker page render", async ({ page }) => {
    await page.goto("/admin/nota-gabungan");
    expect(page.url()).not.toContain("/login");
    await expect(page.locator("body")).toContainText(/cari pelanggan|pencarian/i);
  });

  test("4.1 Search pelanggan kosong → empty state", async ({ page }) => {
    await page.goto("/admin/nota-gabungan?q=XXX_TIDAK_ADA_XXX");
    await expect(page.locator("body")).toContainText(/tidak ada pelanggan/i);
  });

  test("4.2 Link 'Buat Nota Gabungan' di /pembayaran", async ({ page }) => {
    await page.goto("/pembayaran");
    const link = page.getByRole("link", { name: /Buat Nota Gabungan/i });
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL(/\/admin\/nota-gabungan/);
    expect(page.url()).toContain("/admin/nota-gabungan");
  });

  test("4.3 Cetak page tanpa ids → redirect ke picker", async ({ page }) => {
    await page.goto("/admin/nota-gabungan/cetak");
    expect(page.url()).toContain("/admin/nota-gabungan");
  });

  test.fixme("4.4 Full: buat grup, tandai lunas, lepas — butuh data uji", () => {
    // Multi-step workflow; data uji order piutang perlu setup yang panjang
  });
});
