import { test, expect, authFile } from "./helpers";
import fs from "fs";
import path from "path";

/**
 * Skenario 9: PRINT
 * Generate PDF dari halaman laporan & nota gabungan picker.
 * Verify PDF dihasilkan (>1KB).
 */

test.use({ storageState: authFile("admin") });

const OUT_DIR = path.resolve("test-results/pdf");
fs.mkdirSync(OUT_DIR, { recursive: true });

test.describe("09 - Print PDF", () => {
  test("9.0 Laporan ringkasan → PDF", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "page.pdf() hanya Chromium");
    await page.goto("/admin/laporan");
    await page.waitForLoadState("networkidle");
    const pdfPath = path.join(OUT_DIR, "laporan-ringkasan.pdf");
    await page.pdf({ path: pdfPath, format: "A4" });
    const size = fs.statSync(pdfPath).size;
    expect(size).toBeGreaterThan(1024);
  });

  test("9.1 Laporan penjualan → PDF", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "page.pdf() hanya Chromium");
    await page.goto("/admin/laporan/penjualan");
    await page.waitForLoadState("networkidle");
    const pdfPath = path.join(OUT_DIR, "laporan-penjualan.pdf");
    await page.pdf({ path: pdfPath, format: "A4", landscape: true });
    expect(fs.statSync(pdfPath).size).toBeGreaterThan(1024);
  });

  test("9.2 Nota gabungan picker → PDF", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "page.pdf() hanya Chromium");
    await page.goto("/admin/nota-gabungan");
    await page.waitForLoadState("networkidle");
    const pdfPath = path.join(OUT_DIR, "nota-gabungan-picker.pdf");
    await page.pdf({ path: pdfPath, format: "A4" });
    expect(fs.statSync(pdfPath).size).toBeGreaterThan(1024);
  });
});
