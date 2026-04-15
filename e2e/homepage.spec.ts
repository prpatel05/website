import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders the navbar with brand", async ({ page }) => {
    await expect(page.locator("text=pratik.pa.tel").first()).toBeVisible();
  });

  test("renders desktop nav links", async ({ page, viewport }) => {
    test.skip(viewport !== null && viewport.width < 768, "Desktop nav hidden on mobile");
    await expect(page.locator("text=about()").first()).toBeVisible();
    await expect(page.locator("text=writing()").first()).toBeVisible();
    await expect(page.locator("text=contact()").first()).toBeVisible();
  });

  test("renders the hero section with name and role", async ({ page }) => {
    await expect(page.locator("text=Pratik").first()).toBeVisible();
    await expect(page.locator("text=Patel").first()).toBeVisible();
  });

  test("renders the about section", async ({ page }) => {
    const about = page.locator("#about");
    await expect(about).toBeAttached();
    await about.scrollIntoViewIfNeeded();
    await expect(page.getByText("years_exp")).toBeVisible();
    await expect(page.getByText("companies_built")).toBeVisible();
  });

  test("renders the blog preview (writing) section", async ({ page }) => {
    const writing = page.locator("#writing");
    await expect(writing).toBeAttached();
    await writing.scrollIntoViewIfNeeded();
    await expect(page.locator("#writing").getByText("writes")).toBeVisible();
  });

  test("renders the contact section", async ({ page }) => {
    const contact = page.locator("#contact");
    await expect(contact).toBeAttached();
    await contact.scrollIntoViewIfNeeded();
    await expect(page.getByText("pratik@pa.tel")).toBeVisible();
  });

  test("renders the terminal toggle button", async ({ page }) => {
    await expect(page.locator('button[title="Open terminal (Ctrl+K)"]')).toBeVisible();
  });

  test("has skip-to-content link for accessibility", async ({ page }) => {
    const skipLink = page.getByText("Skip to main content");
    await expect(skipLink).toBeAttached();
  });
});
