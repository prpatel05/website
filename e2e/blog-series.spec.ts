import { test, expect } from "./fixtures";


/**
 * Scoped to the series landmark on purpose. A getByRole("link", { name: /next/ })
 * at page scope would also match a heading or a card, which is the class of
 * selector that broke the last two blog PRs.
 */
const seriesRail = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Agent reliability" });

const HUB = "/blog/series/agent-reliability/";
const MEMBER = "/blog/give-your-agent-an-undo-button/";
const FIRST = "/blog/agents-fail-quietly/";
const SECOND = "/blog/give-your-agent-an-undo-button/";
const THIRD = "/blog/teach-your-agent-to-ask-for-help/";
const NON_MEMBER = "/blog/the-entry-level-job-is-the-canary/";
const CAREER = "/blog/own-your-career/";
const SERIES_START = "Agents Fail Quietly";
const CURRENT_NEWEST = "Green Is a Measurement, Not a Decision";

/**
 * Membership is the tag pair, not a slug list — the next weekly post with both
 * tags joins on its own. Hardcoding 7 (then 8) is what broke deploy after PR
 * #173. Read N from the hub so k-of-n rails stay in lockstep with the list.
 */
async function seriesSizeFromHub(page: import("@playwright/test").Page): Promise<number> {
  await page.goto(HUB);
  const titles = page.locator("main ol h2 a");
  const n = await titles.count();
  expect(n, "hub should list at least the series start and one later chapter").toBeGreaterThanOrEqual(2);
  await expect(page.getByText(`${n} posts · oldest first`)).toBeVisible();
  return n;
}

test.describe("agent reliability series rail", () => {
  test("a member post shows the series name, k of n, and neighbours", async ({
    page,
  }) => {
    const n = await seriesSizeFromHub(page);
    await page.goto(MEMBER);

    const rails = seriesRail(page);
    await expect(rails).toHaveCount(2);
    await expect(rails.first()).toBeVisible();
    await expect(rails.first()).toContainText("// series");
    await expect(rails.first()).toContainText("Agent reliability");
    await expect(rails.first()).toContainText(`2 of ${n}`);
    await expect(rails.first().getByText("current")).toBeVisible();
    await expect(
      rails.first().getByRole("link", { name: /previous/ })
    ).toHaveAttribute("href", "/blog/agents-fail-quietly/");
    await expect(
      rails.first().getByRole("link", { name: /next/ })
    ).toHaveAttribute("href", "/blog/teach-your-agent-to-ask-for-help/");
  });

  test("previous and next walk the series, not the archive", async ({ page }) => {
    const n = await seriesSizeFromHub(page);
    await page.goto(FIRST);
    await expect(seriesRail(page).first()).toContainText(`1 of ${n}`);
    await seriesRail(page).first().getByRole("link", { name: /next/ }).click();
    await expect(page).toHaveURL(SECOND);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Give Your Agent an Undo Button"
    );

    await seriesRail(page).first().getByRole("link", { name: /next/ }).click();
    await expect(page).toHaveURL(THIRD);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Teach Your Agent to Ask for Help"
    );

    await seriesRail(page).first().getByRole("link", { name: /previous/ }).click();
    await expect(page).toHaveURL(SECOND);
  });

  test("a non-member post has no series rail", async ({ page }) => {
    await page.goto(NON_MEMBER);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "The Entry-Level Job Is the Canary"
    );
    await expect(seriesRail(page)).toHaveCount(0);
    await expect(page.getByText("// series")).toHaveCount(0);

    await page.goto(CAREER);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Own Your Career"
    );
    await expect(seriesRail(page)).toHaveCount(0);
  });

  test("series links stay keyboard reachable", async ({ page }) => {
    await page.goto(MEMBER);
    const next = seriesRail(page).first().getByRole("link", { name: /next/ });
    await next.focus();
    await expect(next).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(THIRD);
  });

  test("the footer rail is hidden in print; the top rail stays", async ({
    page,
  }) => {
    await page.goto(MEMBER);
    const top = page.locator('[data-series-rail="top"]');
    const footer = page.locator('[data-series-rail="footer"]');
    await expect(top).toBeVisible();
    await expect(footer).toBeVisible();

    await page.emulateMedia({ media: "print" });
    await expect(top).toBeVisible();
    await expect(footer).toBeHidden();
  });
});

test.describe("agent reliability series hub", () => {
  test("lists members oldest-first and opens a post", async ({ page }) => {
    const n = await seriesSizeFromHub(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Agent reliability"
    );

    const titles = page.locator("main ol h2 a");
    await expect(titles).toHaveCount(n);
    await expect(titles.first()).toHaveText(SERIES_START);
    await expect(titles.filter({ hasText: CURRENT_NEWEST })).toHaveCount(1);

    const lastTitle = ((await titles.last().textContent()) ?? "").trim();
    expect(lastTitle.length).toBeGreaterThan(0);
    expect(lastTitle).not.toBe(SERIES_START);
    // Oldest-first: last slot is the newest member, not a frozen 7th-post title.
    expect(lastTitle).not.toBe("Your Eval Suite Measures the Wrong Thing");

    await titles.nth(1).click();
    await expect(page).toHaveURL("/blog/give-your-agent-an-undo-button/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Give Your Agent an Undo Button"
    );
    await expect(seriesRail(page).first()).toContainText(`2 of ${n}`);
  });

  test("series name on the rail links to the hub", async ({ page }) => {
    await page.goto(MEMBER);
    const hub = seriesRail(page)
      .first()
      .getByRole("link", { name: "Agent reliability" });
    await expect(hub).toHaveAttribute("href", HUB);
    await hub.click();
    await expect(page).toHaveURL(HUB);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Agent reliability"
    );
  });

  test("archive entry reaches the hub", async ({ page }) => {
    await page.goto("/blog/");
    await page
      .getByRole("link", { name: /series · Agent reliability/i })
      .click();
    await expect(page).toHaveURL(HUB);
  });
});
