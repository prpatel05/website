import { test, expect } from "@playwright/test";

test.describe("Interactive terminal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("opens terminal via button click", async ({ page }) => {
    await page.locator('button[title="Open terminal (Ctrl+K)"]').click();
    await expect(page.getByText("pratik.pa.tel — bash")).toBeVisible();
    await expect(page.getByText("Welcome to pratik.pa.tel v3.0.1")).toBeVisible();
  });

  test("opens terminal via Ctrl+K shortcut", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.getByText("pratik.pa.tel — bash")).toBeVisible();
  });

  test("closes terminal via Escape key", async ({ page }) => {
    await page.locator('button[title="Open terminal (Ctrl+K)"]').click();
    await expect(page.getByText("pratik.pa.tel — bash")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByText("pratik.pa.tel — bash")).not.toBeVisible();
  });

  test("help command lists available commands", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder('type "help" to get started...').fill("help");
    await page.keyboard.press("Enter");

    await expect(page.getByText("┌─ Available Commands")).toBeVisible();
    await expect(page.getByText("help         Show available commands")).toBeVisible();
  });

  test("whoami command shows profile info", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder('type "help" to get started...').fill("whoami");
    await page.keyboard.press("Enter");

    await expect(page.getByText("CTO & Chief Architect · 3x Company Builder")).toBeVisible();
  });

  test("ls command shows site sections", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const input = page.getByPlaceholder('type "help" to get started...');
    await input.fill("ls");
    await page.keyboard.press("Enter");

    await expect(page.getByText("about/")).toBeVisible();
    await expect(page.getByText("blog/")).toBeVisible();
    await expect(page.getByText("contact/")).toBeVisible();
    await expect(page.getByText("-rw-r--r--  resume.pdf")).toBeVisible();
  });

  test("pwd command shows working directory", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder('type "help" to get started...').fill("pwd");
    await page.keyboard.press("Enter");

    await expect(page.getByText("/home/pratik/portfolio")).toBeVisible();
  });

  test("echo command echoes message back", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder('type "help" to get started...').fill("echo hello world");
    await page.keyboard.press("Enter");

    await expect(page.getByText("hello world", { exact: true })).toBeVisible();
  });

  test("unknown command shows error", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder('type "help" to get started...').fill("fakecmd");
    await page.keyboard.press("Enter");

    await expect(page.getByText("command not found: fakecmd")).toBeVisible();
  });

  test("clear command clears terminal output", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.getByText("Welcome to pratik.pa.tel v3.0.1")).toBeVisible();

    await page.getByPlaceholder('type "help" to get started...').fill("clear");
    await page.keyboard.press("Enter");

    await expect(page.getByText("Welcome to pratik.pa.tel v3.0.1")).not.toBeVisible();
  });
});
