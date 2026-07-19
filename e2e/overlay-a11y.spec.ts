import { test, expect } from "./fixtures";

const openTerminal = 'button[title="Open terminal (Ctrl+K)"]';

test.describe("Mobile menu accessibility", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByText("[menu]").click();
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();
  });

  test("overlay is exposed as a labelled modal dialog", async ({ page }) => {
    const dialog = page.getByRole("dialog", { name: "Site menu" });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  test("close button is reachable by its accessible name", async ({ page }) => {
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(page.getByRole("dialog", { name: "Site menu" })).not.toBeVisible();
  });

  test("Escape dismisses the menu", async ({ page }) => {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Site menu" })).not.toBeVisible();
  });

  test("menu button reports its expanded state", async ({ page }) => {
    await expect(page.getByText("[menu]")).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(page.getByText("[menu]")).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("Terminal accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator(openTerminal).click();
    await expect(page.getByRole("dialog", { name: "Interactive terminal" })).toBeVisible();
  });

  test("command input has an accessible name, not just a placeholder", async ({ page }) => {
    await expect(page.getByRole("textbox", { name: "Terminal command" })).toBeFocused();
  });

  test("output is a labelled live region so results are announced", async ({ page }) => {
    const log = page.getByRole("log", { name: "Terminal output" });
    await expect(log).toHaveAttribute("aria-live", "polite");
  });

  test("exactly one close control is exposed to assistive tech", async ({ page }) => {
    // The macOS-style red dot is a redundant mouse-only affordance; exposing it
    // too would announce two identically named buttons.
    await expect(page.getByRole("button", { name: "Close terminal" })).toHaveCount(1);
  });

  test("close button is reachable by its accessible name", async ({ page }) => {
    await page.getByRole("button", { name: "Close terminal" }).click();
    await expect(page.getByRole("dialog", { name: "Interactive terminal" })).not.toBeVisible();
  });
});
