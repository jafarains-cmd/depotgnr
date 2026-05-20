import { test, expect, authFile } from "./helpers";

/**
 * Skenario 7: LAPORAN & EXPORT
 * Verifikasi 5 tab laporan render + tombol export PDF (cetak) & CSV
 * berfungsi. Test CSV: download terjadi + content multi-section.
 */

test.use({ storageState: authFile("admin") });

test.describe("07 - Laporan", () => {
  test("7.0 Ringkasan render", async ({ page }) => {
    await page.goto("/admin/laporan");
    await expect(page.locator("body")).toContainText(/Total Omzet/i);
    await expect(page.locator("body")).toContainText(/Profit Bersih/i);
  });

  test("7.1 Nav tab muncul di tiap halaman", async ({ page }) => {
    const tabs = [
      "/admin/laporan",
      "/admin/laporan/penjualan",
      "/admin/laporan/order-antar",
      "/admin/laporan/pengeluaran",
      "/admin/laporan/bonus-kurir",
    ];
    for (const url of tabs) {
      await page.goto(url);
      // Tab nav memiliki semua link
      await expect(page.getByRole("link", { name: /Ringkasan/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Penjualan/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Order Antar/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Pengeluaran/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Bonus Kurir/i })).toBeVisible();
    }
  });

  test("7.2 Penjualan — tabel + export buttons", async ({ page }) => {
    await page.goto("/admin/laporan/penjualan");
    // Tabel header
    await expect(page.locator("body")).toContainText(/No\. ?Nota/i);
    await expect(page.locator("body")).toContainText(/Kasir/i);
    await expect(page.locator("body")).toContainText(/Pelanggan/i);
    // Tombol export
    await expect(page.getByRole("button", { name: /Cetak.*PDF/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Excel.*CSV/i })).toBeVisible();
  });

  test("7.3 Order Antar — tabel + export", async ({ page }) => {
    await page.goto("/admin/laporan/order-antar");
    await expect(page.locator("body")).toContainText(/No\. ?Order/i);
    await expect(page.getByRole("button", { name: /Cetak.*PDF/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Excel.*CSV/i })).toBeVisible();
  });

  test("7.4 Pengeluaran — tabel + export", async ({ page }) => {
    await page.goto("/admin/laporan/pengeluaran");
    await expect(page.locator("body")).toContainText(/Kategori/i);
    await expect(page.getByRole("button", { name: /Cetak.*PDF/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Excel.*CSV/i })).toBeVisible();
  });

  test("7.5 Bonus Kurir — tabel + export", async ({ page }) => {
    await page.goto("/admin/laporan/bonus-kurir");
    await expect(page.locator("body")).toContainText(/Galon/i);
    await expect(page.getByRole("button", { name: /Cetak.*PDF/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Excel.*CSV/i })).toBeVisible();
  });

  test("7.6 CSV download — content multi-section + BOM", async ({ request }) => {
    const resp = await request.get(
      "/api/laporan/export?jenis=penjualan&from=2026-01-01&to=2026-12-31",
    );
    expect(resp.ok()).toBeTruthy();
    expect(resp.headers()["content-type"]).toContain("text/csv");
    expect(resp.headers()["content-disposition"]).toContain("attachment");
    const csv = await resp.text();
    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM
    expect(csv).toMatch(/LAPORAN PENJUALAN/);
    expect(csv).toMatch(/Periode/);
  });

  test("7.7 CSV ringkasan format benar", async ({ request }) => {
    const resp = await request.get(
      "/api/laporan/export?jenis=ringkasan&from=2026-01-01&to=2026-12-31",
    );
    expect(resp.ok()).toBeTruthy();
    const csv = await resp.text();
    expect(csv).toMatch(/RINGKASAN/);
    expect(csv).toMatch(/Total Omzet/);
  });
});
