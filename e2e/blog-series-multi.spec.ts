import { test, expect } from "./fixtures";
import { discoverPostSlugs } from "../scripts/blog-posts.mjs";

/**
 * The formal series beyond Agent reliability. Each rail is a navigation
 * landmark named after its series, so selectors stay scoped to the rail and
 * never match a card or a heading elsewhere on the page.
 */
const rail = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("navigation", { name, exact: true });

const SWA_HUB = "/blog/series/ship-with-agents/";
const AIP_HUB = "/blog/series/agents-in-production/";
const AR_HUB = "/blog/series/agent-reliability/";

const SLATE = [
  { slug: "let-it-run-for-days", title: "Let It Run for Days" },
  {
    slug: "your-stack-is-a-team-not-a-subscription",
    title: "Your Stack Is a Team, Not a Subscription",
  },
  { slug: "the-phone-is-a-valid-dev-machine", title: "The Phone Is a Valid Dev Machine" },
  { slug: "pick-the-model-for-the-job", title: "Pick the Model for the Job" },
  {
    slug: "parallel-agents-need-ownership-too",
    title: "Parallel Agents Need Ownership Too",
  },
];

const RETRY = "a-retry-is-not-a-replay";
const retryPresent = discoverPostSlugs().includes(RETRY);

test.describe("Ship With Agents series", () => {
  test("hub lists the five-post slate oldest first", async ({ page }) => {
    await page.goto(SWA_HUB);
    await expect(page).toHaveTitle("Ship With Agents — Pratik Patel");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ship With Agents");
    await expect(page.getByText("5 posts · oldest first")).toBeVisible();
    await expect(page.locator("main ol h2 a")).toHaveText(SLATE.map((p) => p.title));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://pratik.pa.tel${SWA_HUB}`
    );
  });

  for (const [i, member] of SLATE.entries()) {
    test(`${member.slug} shows ${i + 1} of 5 and links the hub`, async ({ page }) => {
      await page.goto(`/blog/${member.slug}/`);
      const rails = rail(page, "Ship With Agents");
      await expect(rails).toHaveCount(2);
      const top = rails.first();
      await expect(top).toContainText(`${i + 1} of 5`);
      await expect(top.getByRole("link", { name: "Ship With Agents" })).toHaveAttribute(
        "href",
        SWA_HUB
      );
      const prev = top.getByRole("link", { name: /previous/ });
      const next = top.getByRole("link", { name: /next/ });
      if (i === 0) await expect(prev).toHaveCount(0);
      else await expect(prev).toHaveAttribute("href", `/blog/${SLATE[i - 1].slug}/`);
      if (i === SLATE.length - 1) await expect(next).toHaveCount(0);
      else await expect(next).toHaveAttribute("href", `/blog/${SLATE[i + 1].slug}/`);
      // One series per post.
      await expect(rail(page, "Agent reliability")).toHaveCount(0);
    });
  }

  test("next walks the slate from the first post", async ({ page }) => {
    await page.goto(`/blog/${SLATE[0].slug}/`);
    await rail(page, "Ship With Agents").first().getByRole("link", { name: /next/ }).click();
    await expect(page).toHaveURL(`/blog/${SLATE[1].slug}/`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(SLATE[1].title);
  });

  test("archive entry reaches the hub", async ({ page }) => {
    await page.goto("/blog/");
    await page.getByRole("link", { name: /series · Ship With Agents/i }).click();
    await expect(page).toHaveURL(SWA_HUB);
  });
});

test.describe("Agents in Production series", () => {
  test("Half the Demos Are Fake Now stays in Agent reliability", async ({ page }) => {
    await page.goto("/blog/half-the-demos-are-fake-now/");
    await expect(rail(page, "Agent reliability")).toHaveCount(2);
    await expect(rail(page, "Agents in Production")).toHaveCount(0);
  });

  test("the reliability hub never lists A Retry Is Not a Replay", async ({ page }) => {
    await page.goto(AR_HUB);
    await expect(page.locator("main ol h2 a")).not.toContainText(["A Retry Is Not a Replay"]);
  });

  test("hub is a 404 until its first post exists, then lists it", async ({ page }) => {
    await page.goto(AIP_HUB);
    if (!retryPresent) {
      await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
      return;
    }
    await expect(page).toHaveTitle("Agents in Production — Pratik Patel");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Agents in Production");
    await expect(page.locator("main ol h2 a").first()).toHaveText("A Retry Is Not a Replay");
  });

  test("A Retry Is Not a Replay rails on Agents in Production only", async ({ page }) => {
    test.skip(!retryPresent, "post lives on PR #241 until it merges");
    await page.goto(`/blog/${RETRY}/`);
    const rails = rail(page, "Agents in Production");
    await expect(rails).toHaveCount(2);
    await expect(rails.first()).toContainText("1 of");
    await expect(
      rails.first().getByRole("link", { name: "Agents in Production" })
    ).toHaveAttribute("href", AIP_HUB);
    await expect(rail(page, "Agent reliability")).toHaveCount(0);
  });
});
