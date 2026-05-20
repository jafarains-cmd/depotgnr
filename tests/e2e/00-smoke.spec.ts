import { test, expect, authFile } from "./helpers";

test.describe("00 - Smoke", () => {
  test("homepage publik bisa diakses", async ({ page }) => {
    await page.goto("/");
    expect(await page.title()).not.toBe("");
  });

  test("login page render", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder(/email \/ username/)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /^Masuk$/i })).toBeVisible();
  });

  test("storage state admin bekerja → akses /admin/dashboard", async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile("admin") });
    const page = await context.newPage();
    await page.goto("/admin/dashboard");
    expect(page.url()).not.toContain("/login");
    await context.close();
  });
});
