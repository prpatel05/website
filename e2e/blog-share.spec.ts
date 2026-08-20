import { test, expect } from "./fixtures";
import { linkedInShareUrl, postCanonicalUrl, RSS_URL, xShareUrl } from "../src/lib/share-urls";

const POST = "/blog/the-entry-level-job-is-the-canary/";
const SLUG = "the-entry-level-job-is-the-canary";
const TITLE = "The Entry-Level Job Is the Canary";
const CANONICAL = postCanonicalUrl(SLUG);

const share = (page: import("@playwright/test").Page) => page.getByText("// share");
const subscribe = (page: import("@playwright/test").Page) => page.getByText("// subscribe");

test.describe("blog share and subscribe row", () => {
  test("renders copy, share, and subscribe controls after the body", async ({ page }) => {
    await page.goto(POST);

    await expect(share(page)).toBeVisible();
    await expect(subscribe(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "copy url" })).toBeVisible();
    await expect(page.getByRole("link", { name: "share on x" })).toHaveAttribute(
      "href",
      xShareUrl(CANONICAL, TITLE)
    );
    await expect(page.getByRole("link", { name: "linkedin" })).toHaveAttribute(
      "href",
      linkedInShareUrl(CANONICAL)
    );
    await expect(page.getByRole("link", { name: "rss" })).toHaveAttribute("href", RSS_URL);
    await expect(page.getByRole("link", { name: "substack" })).toHaveAttribute(
      "href",
      "https://prpatel05.substack.com"
    );
  });

  test("copy writes the canonical URL and confirms", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(POST);

    const button = page.getByRole("button", { name: "copy url" });
    await button.click();

    await expect(page.getByRole("button", { name: "copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CANONICAL);
  });

  test("copy is keyboard reachable", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(POST);

    const button = page.getByRole("button", { name: "copy url" });
    await button.focus();
    await expect(button).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CANONICAL);
  });

  test("print hides the share row", async ({ page }) => {
    await page.goto(POST);
    await expect(share(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "copy url" })).toBeVisible();

    await page.emulateMedia({ media: "print" });
    await expect(share(page)).toBeHidden();
    await expect(subscribe(page)).toBeHidden();
    await expect(page.getByRole("button", { name: "copy url" })).toBeHidden();
  });
});
