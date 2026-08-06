import {
  test,
  expect,
  TERMINAL_TOGGLE,
  openTerminalByClick,
  proveReactIsLive,
  type Page,
} from "./fixtures";

test.describe("Interactive terminal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("opens terminal via button click", async ({ page }) => {
    // Deliberately not `openTerminalByClick` — the click path is this test's
    // subject, and every other test in the file leans on it, so it stays
    // spelled out rather than delegating to the helper it underwrites.
    await page.locator(TERMINAL_TOGGLE).click();
    await expect(page.getByText("pratik.pa.tel — bash")).toBeVisible();
    await expect(page.getByText("Welcome to pratik.pa.tel v3.0.1")).toBeVisible();
  });

  test("opens terminal via Ctrl+K shortcut", async ({ page }) => {
    // The one test whose subject is the shortcut. `proveReactIsLive` first, so a
    // failure here means the binding is wrong rather than that the press beat
    // hydration — see the helper for the measurements.
    await proveReactIsLive(page);

    await page.keyboard.press("Control+k");
    await expect(page.getByText("pratik.pa.tel — bash")).toBeVisible();
  });

  test("closes terminal via Escape key", async ({ page }) => {
    await openTerminalByClick(page);
    await expect(page.getByText("pratik.pa.tel — bash")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByText("pratik.pa.tel — bash")).not.toBeVisible();
  });

  /**
   * These care only about what a command prints, not about how the terminal was
   * opened — so they open through the click handler, which cannot outrun
   * hydration. Opening with Ctrl+K here bought no coverage the shortcut test
   * above does not already give, and cost seven flaky tests per CI run.
   */
  test.describe("commands", () => {
    test.beforeEach(async ({ page }) => {
      await openTerminalByClick(page);
    });

    const command = (page: Page) => page.getByPlaceholder('type "help" to get started...');

    test("help command lists available commands", async ({ page }) => {
      await command(page).fill("help");
      await page.keyboard.press("Enter");

      await expect(page.getByText("┌─ Available Commands")).toBeVisible();
      await expect(page.getByText("help         Show available commands")).toBeVisible();
    });

    test("whoami command shows profile info", async ({ page }) => {
      await command(page).fill("whoami");
      await page.keyboard.press("Enter");

      await expect(page.getByText("CTO & Chief Architect · 3x Company Builder")).toBeVisible();
    });

    test("ls command shows site sections", async ({ page }) => {
      await command(page).fill("ls");
      await page.keyboard.press("Enter");

      await expect(page.getByText("about/")).toBeVisible();
      await expect(page.getByText("blog/")).toBeVisible();
      await expect(page.getByText("contact/")).toBeVisible();
      await expect(page.getByText("-rw-r--r--  resume.pdf")).toBeVisible();
    });

    test("pwd command shows working directory", async ({ page }) => {
      await command(page).fill("pwd");
      await page.keyboard.press("Enter");

      await expect(page.getByText("/home/pratik/portfolio")).toBeVisible();
    });

    test("echo command echoes message back", async ({ page }) => {
      await command(page).fill("echo hello world");
      await page.keyboard.press("Enter");

      await expect(page.getByText("hello world", { exact: true })).toBeVisible();
    });

    test("unknown command shows error", async ({ page }) => {
      await command(page).fill("fakecmd");
      await page.keyboard.press("Enter");

      await expect(page.getByText("command not found: fakecmd")).toBeVisible();
    });

    test("clear command clears terminal output", async ({ page }) => {
      await expect(page.getByText("Welcome to pratik.pa.tel v3.0.1")).toBeVisible();

      await command(page).fill("clear");
      await page.keyboard.press("Enter");

      await expect(page.getByText("Welcome to pratik.pa.tel v3.0.1")).not.toBeVisible();
    });
  });
});
