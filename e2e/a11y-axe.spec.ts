import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { renderMarkdownToHtml } from "../scripts/markdown-html.mjs";
import { test, expect,
  openMobileMenu,
  openTerminalByClick,
  expectOverlayOpen,
  TERMINAL_DIALOG,
} from "./fixtures";

/**
 * Every route passes the WCAG 2.1 AA rule set, on both breakpoints.
 *
 * The a11y coverage on this site is a set of hand-written rules, each added the
 * day something specific broke: named landmarks, the pipe leaking into card
 * accessible names, focus traps in the two overlays, target size. Each is
 * sharper than a generic engine on the thing it owns, and they stay — but
 * together they cover the handful of rules somebody thought to write, and
 * nothing else. Nothing on the site checks form labels, ARIA attribute
 * validity, duplicate ids, list structure, or colour contrast outside the two
 * specific pairs `text-contrast.test.ts` pins.
 *
 * Standing this up while the site is clean is the point. Measured across all 25
 * sitemap routes on 2026-08-09, axe-core 4.10 reports zero violations at
 * wcag2a/wcag2aa/wcag21a/wcag21aa — so this starts green and its whole job is
 * the next regression, not a backlog.
 *
 * Both Playwright projects matter, as in `target-size.spec.ts`: Navbar's
 * `about()`/`writing()`/`contact()` row is `hidden md:flex` and only exists on
 * desktop, while the `[menu]` overlay is mobile-only.
 *
 * `best-practice` is deliberately excluded. It is axe's non-normative advice
 * (heading-order, region, landmark uniqueness), it moves between minor
 * releases, and a CI gate that fails on a non-normative rule change is a gate
 * that gets disabled. `landmarks-and-names.spec.ts` already pins the parts of
 * that advice this site actually cares about, by hand and on purpose.
 */

const SITEMAP = fileURLToPath(new URL("../dist/sitemap.xml", import.meta.url));

const routes = [...readFileSync(SITEMAP, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  ([, loc]) => new URL(loc).pathname
);

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.describe("every route passes axe at WCAG 2.1 AA", () => {
  for (const route of routes) {
    test(`${route} has no accessibility violations`, async ({ page }) => {
      await page.goto(route);

      // Scanned hydrated. The prerendered markup is what a crawler sees, but a
      // reader using AT gets the live tree — that is where aria-expanded,
      // dialog roles and focus management exist at all.
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();

      const detail = violations
        .map(
          (v) =>
            `[${v.impact}] ${v.id} — ${v.help}\n` +
            v.nodes.map((n) => `      ${n.target.join(" ")}\n      ${n.html.slice(0, 140)}`).join("\n")
        )
        .join("\n  ");

      expect(
        violations.map((v) => v.id),
        `${route} at ${page.viewportSize()?.width}px has ${violations.length} violation(s):\n  ${detail}`
      ).toEqual([]);
    });
  }

  /**
   * The overlay exists only while it is open, so the per-route sweep never sees
   * it — the same blind spot `target-size.spec.ts` calls out. It is also the
   * one surface on the site that is pure controls plus a focus trap.
   */
  test("the open mobile menu passes axe", async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) >= 768,
      "the [menu] button is md:hidden, so there is no overlay to open on desktop"
    );

    await page.goto("/");
    // A click rather than a bare toggle, because `setOpen` is React state and
    // Playwright's actionability checks are what wait out hydration.
    await openMobileMenu(page);

    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();

    expect(
      violations.map((v) => v.id),
      `the open mobile menu has ${violations.length} violation(s):\n  ${violations
        .map((v) => `[${v.impact}] ${v.id} — ${v.help}`)
        .join("\n  ")}`
    ).toEqual([]);
  });

  /**
   * The terminal was the other overlay-shaped blind spot, and unlike the menu
   * it had never been scanned at all — not its `role="log"` live region, not
   * its unlabelled-by-default command input, not the `aria-hidden` traffic-light
   * button sitting next to a real one. PRA-912 is what surfaced the gap.
   */
  test("the open terminal passes axe", async ({ page }) => {
    await page.goto("/");
    await openTerminalByClick(page);

    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();

    expect(
      violations.map((v) => v.id),
      `the open terminal has ${violations.length} violation(s):\n  ${violations
        .map((v) => `[${v.impact}] ${v.id} — ${v.help}`)
        .join("\n  ")}`
    ).toEqual([]);
  });

  /**
   * Both at once — reachable by Ctrl+K with the menu up, and a state no sweep
   * saw before PRA-912. Two `aria-modal` dialogs is the shape axe cannot flag
   * (there is no rule for it) but which everything downstream of it depends on,
   * so `stacked-overlays.spec.ts` owns that assertion by hand and this scans
   * for whatever else the pair produces — the covered overlay is `inert` here,
   * which changes what is in the accessibility tree at all.
   */
  test("the terminal stacked over the mobile menu passes axe", async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) >= 768,
      "the [menu] button is md:hidden, so there is no menu to stack on"
    );

    await page.goto("/");
    await openMobileMenu(page);
    await page.keyboard.press("Control+k");
    await expectOverlayOpen(page, TERMINAL_DIALOG);

    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();

    expect(
      violations.map((v) => v.id),
      `the stacked overlays have ${violations.length} violation(s):\n  ${violations
        .map((v) => `[${v.impact}] ${v.id} — ${v.help}`)
        .join("\n  ")}`
    ).toEqual([]);
  });

  /**
   * A fenced block wider than the phone.
   *
   * The route sweep above cannot catch this. `pre` is `overflow-x-auto`, so it
   * only becomes a scroll container when a line does not fit — which depends on
   * rendered pixel width, not on anything in the markdown. At 1280px a code
   * sample fits and nothing scrolls; at 393px the same markup is a scrollable
   * region, and one no keyboard can reach or pan fails WCAG 2.1.1. Worse, the
   * sweep is vacuous either way: no merged post contains a fenced block at all,
   * standalone ones having only become legal in #113. The first author to paste
   * a shell command would have found out from CI, not from the page.
   *
   * So the block is rendered here rather than found on a route, by the same
   * renderer the build uses — the assertion cannot drift from the markup that
   * ships, and it does not wait on a post to exist. The scroll check in the
   * middle is what keeps this from going quietly vacuous the way the sweep did.
   */
  test("a code sample wider than the phone stays reachable by keyboard", async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) >= 768,
      "at desktop width the sample fits, nothing scrolls, and there is no violation to catch"
    );

    await page.goto("/");

    // The command from PRA-934's own verification section: ~95 monospace
    // characters, and `pre` does not wrap, so it is far past 393px.
    const html = renderMarkdownToHtml(
      "```sh\nnpx playwright test e2e/a11y-axe.spec.ts --project=mobile-chrome --reporter=line\n```\n"
    );
    await page.evaluate((body) => {
      const probe = document.createElement("div");
      probe.id = "wide-code-probe";
      probe.innerHTML = body;
      document.body.appendChild(probe);
    }, html);

    const pre = page.locator("#wide-code-probe pre");
    expect(
      await pre.evaluate((el) => el.scrollWidth > el.clientWidth),
      "the sample no longer overflows, so this test would pass without proving anything"
    ).toBe(true);

    // Tab order membership, not `focus()` — that is the assertion this test
    // shipped with, and it passed against the unfixed renderer: Chrome grants
    // programmatic focus to a scroll container whether or not any keyboard can
    // get there. Being reachable by Tab is the thing the rule is about, and it
    // holds whichever id the engine files the violation under.
    expect(await pre.evaluate((el) => el.tabIndex)).toBeGreaterThanOrEqual(0);

    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_AA)
      .include("#wide-code-probe")
      .analyze();

    expect(
      violations.map((v) => v.id),
      `a wide code block has ${violations.length} violation(s):\n  ${violations
        .map((v) => `[${v.impact}] ${v.id} — ${v.help}`)
        .join("\n  ")}`
    ).toEqual([]);
  });

  /**
   * Control: axe is actually running and can fail.
   *
   * Every assertion above is an empty-array check, which is exactly what a
   * silently broken scanner also produces — a bad selector, a version that
   * stopped injecting, a `withTags` typo narrowing to nothing. This injects two
   * unambiguous violations and requires the engine to name both.
   */
  test("the scanner reports violations when they exist", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.id = "axe-control-probe";
      probe.innerHTML = '<img src="/favicon-32.png"><button></button>';
      document.body.appendChild(probe);
    });

    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_AA)
      .include("#axe-control-probe")
      .analyze();

    expect(violations.map((v) => v.id).sort()).toEqual(["button-name", "image-alt"]);
  });
});
