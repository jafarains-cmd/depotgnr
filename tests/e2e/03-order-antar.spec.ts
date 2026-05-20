import { test, expect, authFile } from "./helpers";

/**
 * Skenario 3: ORDER ANTAR (pelanggan → kurir)
 * Full multi-role workflow butuh banyak helper. Di sini smoke check
 * setiap halaman terbuka tanpa error.
 */

test.describe("03 - Order Antar (smoke)", () => {
  test("3.1 Pelanggan: halaman order-baru render", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("pelanggan") });
    const page = await ctx.newPage();
    await page.goto("/pelanggan/order-baru");
    expect(page.url()).not.toContain("/login");
    await expect(page.locator("body")).toContainText(/produk|pesan|order|alamat/i);
    await ctx.close();
  });

  test("3.2 Kasir: list order render", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("kasir") });
    const page = await ctx.newPage();
    await page.goto("/kasir/order");
    expect(page.url()).not.toContain("/login");
    await ctx.close();
  });

  test("3.3 Kurir: home dengan antrian", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("kurir") });
    const page = await ctx.newPage();
    await page.goto("/kurir");
    expect(page.url()).not.toContain("/login");
    // Pasti ada salah satu: aktif/antrian/selesai/belum ada order
    await expect(page.locator("body")).toContainText(
      /aktif|antrian|hari ini|belum ada/i,
    );
    await ctx.close();
  });

  test("3.4 Kurir: halaman riwayat dengan filter", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("kurir") });
    const page = await ctx.newPage();
    await page.goto("/kurir/riwayat");
    expect(page.url()).not.toContain("/login");
    await expect(page.locator("body")).toContainText(/riwayat|filter|tanggal/i);
    await ctx.close();
  });

  test("3.5 Admin: pembayaran tab piutang render", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin") });
    const page = await ctx.newPage();
    await page.goto("/pembayaran?tab=piutang");
    expect(page.url()).not.toContain("/login");
    await expect(page.locator("body")).toContainText(/pembayaran|piutang|lunas/i);
    await ctx.close();
  });

  test.fixme("3.6 Full workflow: order → assign → antar → bayar → konfirmasi", () => {
    // Skip — workflow multi-role kompleks, di-cover oleh manual QA
  });
});
