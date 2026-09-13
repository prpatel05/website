import { test, expect } from "./fixtures";

test.describe("CRT noise chrome toggle", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem("pratik.crt-noise");
      } catch {
        /* ignore */
      }
    });
    await page.goto("/");
  });

  test("stays off by default and can be toggled on", async ({ page }) => {
    await expect(page.locator(".crt-noise")).toHaveCount(0);
    const toggle = page.getByRole("button", { name: /Turn CRT noise on/i });
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await expect(page.locator(".crt-noise")).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Turn CRT noise off/i })).toBeVisible();
  });

  test("stays off under prefers-reduced-motion even when stored on", async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("pratik.crt-noise", "1");
      } catch {
        /* ignore */
      }
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".crt-noise")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /CRT noise unavailable with reduced motion/i })
    ).toBeDisabled();
  });
});
