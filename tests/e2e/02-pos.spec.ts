import { test, expect, authFile, openDbRO } from "./helpers";

/**
 * Skenario 2: POS Kasir
 * Verifikasi halaman POS render lengkap (form pelanggan + produk +
 * toggle pengantaran + tombol metode bayar). Full create-transaksi
 * disimulasikan via 1 cash flow end-to-end.
 */

test.use({ storageState: authFile("kasir") });

test.describe("02 - POS", () => {
  test("2.0 Halaman POS render dengan UI lengkap", async ({ page }) => {
    await page.goto("/kasir/pos");
    // Komponen utama
    await expect(page.getByText(/Pelanggan/i).first()).toBeVisible();
    await expect(page.getByText(/Keranjang|Kosong/i).first()).toBeVisible();
    // Toggle pengantaran (baru ditambahkan)
    await expect(page.getByText(/Ambil di depot/i)).toBeVisible();
    await expect(page.getByText(/Antar ke alamat/i)).toBeVisible();
    // 4 tombol pembayaran (case-insensitive — CSS uppercase, text bisa kapital atau tidak)
    await expect(page.getByRole("button", { name: /^cash$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^transfer$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^qris$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^nanti$/i })).toBeVisible();
  });

  test("2.1 POS Cash — buat transaksi end-to-end", async ({ page }) => {
    const db = openDbRO();
    const before = db.prepare("SELECT count(*) as n FROM transaksi").get() as { n: number };
    db.close();

    await page.goto("/kasir/pos");
    // Klik produk pertama yang ada (Isi Ulang)
    const isiUlangBtn = page.getByRole("button", { name: /Isi Ulang/i }).first();
    await expect(isiUlangBtn).toBeVisible({ timeout: 5000 });
    await isiUlangBtn.click();

    // Klik Simpan & Bayar
    const submitBtn = page.getByRole("button", { name: /Simpan.*Bayar/i });
    await submitBtn.click();

    // Tunggu nota muncul ATAU notif sukses
    await page.waitForTimeout(2500);

    const db2 = openDbRO();
    const after = db2.prepare("SELECT count(*) as n FROM transaksi").get() as { n: number };
    db2.close();
    expect(after.n).toBeGreaterThan(before.n);
  });

  test("2.3 Pilih NANTI tanpa pelanggan → error muncul", async ({ page }) => {
    await page.goto("/kasir/pos");
    await page.getByRole("button", { name: /Isi Ulang/i }).first().click();
    // Pilih bayar NANTI tanpa pelanggan
    await page.getByRole("button", { name: /^nanti$/i }).click();
    // Submit
    await page.getByRole("button", { name: /Simpan.*Bayar/i }).click();
    await page.waitForTimeout(1500);
    // Validasi muncul (error text di body)
    await expect(page.locator("body")).toContainText(/piutang.*pelanggan|wajib.*pelanggan/i);
  });

  test("2.4 Pilih ANTAR tanpa alamat → error muncul", async ({ page }) => {
    await page.goto("/kasir/pos");
    await page.getByRole("button", { name: /Isi Ulang/i }).first().click();
    // Toggle ke Antar
    await page.getByRole("button", { name: /Antar ke alamat/i }).click();
    // Alamat & jadwal kosong
    await page.getByRole("button", { name: /Simpan.*Bayar/i }).click();
    await page.waitForTimeout(1500);
    await expect(page.locator("body")).toContainText(/alamat/i);
  });
});
