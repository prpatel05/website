import { test, expect, type Page, openMobileMenu, openTerminalByClick } from "./fixtures";
import { htmlRoutesFromSitemap } from "./sitemap-routes";

/**
 * A reader may respace our text, and must not lose anything by doing it.
 *
 * WCAG 2.1 SC 1.4.12 Text Spacing: with line-height at 1.5x font size,
 * letter-spacing at 0.12em, word-spacing at 0.16em and paragraph spacing at 2em,
 * there must be no loss of content or functionality. Readers with dyslexia and
 * low-vision readers apply exactly this through a browser extension or a user
 * stylesheet, so it is a real reading mode and not a hypothetical one.
 *
 * Nothing else in the suite covers it. `axe` has no rule for text spacing — it
 * cannot restyle the page and re-measure, so `a11y-axe.spec.ts` passes either
 * way. `mobile-overflow.spec.ts` measures the same pages at the same widths but
 * only at our own spacing, which is the case that already works. The criterion
 * is only ever violated by the *combination* of our layout and the reader's
 * spacing, and that combination had no test.
 *
 * ## Why control and treatment share one page visit
 *
 * The naive version of this test — load the page with the override and assert
 * nothing is clipped — is unreadable, because plenty is legitimately clipped at
 * our own spacing too. Decorative `overflow-hidden` wrappers, framer transforms
 * baked into the prerendered markup, and entrance offsets all put content past
 * a container edge in the ordinary case.
 *
 * So each test measures twice in the same visit, at the same scroll position and
 * the same animation phase: once at our spacing, then again with the override
 * applied. Everything structural appears in both and cancels. Only an offender
 * that is *new* under the override is reported, which is exactly the criterion.
 *
 * ## Why the identity key carries no coordinates
 *
 * The offscreen-control check dedupes on tag, class and accessible name and
 * deliberately not on position. Keying on `top=` made every already-below-the-
 * fold control read as a fresh loss the moment the override made the page
 * taller, which reported 13 offenders on all five viewports — a uniform,
 * viewport-independent count, which is the signature of a broken probe rather
 * than a defect. A control that was already offscreen and merely moved has not
 * been lost.
 *
 * ## Why a control below the fold is not automatically a failure
 *
 * Twice, in two different ways. On an ordinary page the document scrolls, so a
 * link the taller text pushes past the fold is still reachable; treating that as
 * a loss reported two innocent links on `/blog/`. And inside the mobile menu —
 * which is pinned, so the document cannot help — the panel is
 * `max-h-full overflow-y-auto`, and its last link starting 2px below a 256px
 * viewport is reachable by scrolling the panel. That one was measured: 80px of
 * panel scroll, after which the link is fully in view and answers a
 * topmost-paint hit test. So a control counts as lost only when it is pinned
 * inside a `position: fixed` subtree with nothing scrollable between.
 */

const routes = htmlRoutesFromSitemap();

/**
 * At the wide width the posts stop being distinct from one another — they are one
 * component rendering one column, and the content variation that justifies the
 * full sweep at 320 has room to fit. So the wide pass covers one of each *layout*
 * instead: the homepage's multi-column sections, the blog index's card grid, and
 * a single post body.
 *
 * This is a deliberate coverage cap, taken on measurement rather than instinct:
 * the full 26x2x2 matrix ran green in CI but took it from ~10.4 to 18 minutes,
 * and a criterion that currently passes everywhere does not earn +73% on every
 * push. The narrow width, where the failures would actually be, keeps every post.
 */
const WIDE_ROUTES = ["/", "/blog/", routes.find((r) => /^\/blog\/(?!series\/)[^/]+\/$/.test(r))!];

/** The exact values named in SC 1.4.12. */
const SPACING_CSS = `
* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
p { margin-bottom: 2em !important; }
`;

/** Entrance staggers run to ~3s on the longest list (PRA-951). */
const SETTLE_MS = 3500;

/**
 * Every test here sets its own viewport, and both configured projects drive the
 * same chromium build — so under `mobile-chrome` this file would re-measure the
 * identical layout at the identical widths and double a slow suite for nothing.
 * The one thing the device profile does change, touch input, this file never
 * uses: it reads geometry and never taps.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "chromium",
    "viewports are set explicitly, so the device profile would re-run identical work"
  );
});

type Reading = {
  pageOverflow: number;
  clipped: { key: string; detail: string }[];
  offscreen: { key: string; detail: string }[];
};

const measure = (page: Page): Promise<Reading> =>
  page.evaluate(() => {
    const doc = document.documentElement;

    // Content that a container hides and no one can scroll to.
    const clipped: { key: string; detail: string }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const cs = getComputedStyle(el);
      const hidesX = cs.overflowX === "hidden" || cs.overflowX === "clip";
      const hidesY = cs.overflowY === "hidden" || cs.overflowY === "clip";
      if (!hidesX && !hidesY) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;

      const overX = hidesX ? el.scrollWidth - el.clientWidth : 0;
      const overY = hidesY ? el.scrollHeight - el.clientHeight : 0;
      if (overX <= 1 && overY <= 1) continue;

      const cls = typeof el.className === "string" ? el.className : "";
      const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
      clipped.push({
        key: `${el.tagName.toLowerCase()}.${cls}`,
        detail: `<${el.tagName.toLowerCase()} class="${cls}"> overX=${overX} overY=${overY} box=${Math.round(
          box.width
        )}x${Math.round(box.height)} "${text}"`,
      });
    }

    // A control pushed out of the viewport with no way to scroll to it is a loss
    // of functionality, which the clipping check above cannot see.
    //
    // "No way to scroll to it" is the whole difficulty. On an ordinary page the
    // document scrolls, so a link pushed below the fold by the taller text is
    // still perfectly reachable — an earlier revision of this file flagged two
    // such links on /blog/ and called them losses. The check is only meaningful
    // inside a `position: fixed` subtree, where scrolling the page cannot bring
    // the control back, and even there a scrollable panel between the control
    // and the fixed root makes it reachable again.
    const outOfReach = (el: HTMLElement) => {
      for (let n = el.parentElement; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        const scrolls = /(auto|scroll)/.test(cs.overflowY + cs.overflowX);
        if (scrolls && (n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1)) {
          return false; // a panel scrolls to it
        }
        if (cs.position === "fixed") return true; // pinned; the document cannot help
      }
      return false; // document scroll reaches it
    };

    const offscreen: { key: string; detail: string }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(
      "button, a[href], input, [role='button']"
    )) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      if (getComputedStyle(el).visibility === "hidden") continue;
      const out = b.top - doc.clientHeight > 0 || b.left - doc.clientWidth > 0 || b.bottom < 0 || b.right < 0;
      if (!out || !outOfReach(el)) continue;

      const name = (el.textContent ?? el.getAttribute("aria-label") ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 40);
      const cls = typeof el.className === "string" ? el.className : "";
      offscreen.push({
        key: `${el.tagName.toLowerCase()}|${cls}|${name}`,
        detail: `<${el.tagName.toLowerCase()}> "${name}" top=${Math.round(b.top)} left=${Math.round(
          b.left
        )} viewport=${doc.clientWidth}x${doc.clientHeight}`,
      });
    }

    return { pageOverflow: doc.scrollWidth - doc.clientWidth, clipped, offscreen };
  });

/** Measures at our spacing, applies the override, measures again, reports the delta. */
async function expectNoLossUnderTextSpacing(page: Page, label: string) {
  const control = await measure(page);

  await page.addStyleTag({ content: SPACING_CSS });
  await page.waitForTimeout(400);

  const treatment = await measure(page);

  const seenClipped = new Set(control.clipped.map((c) => c.key));
  const freshClipped = treatment.clipped.filter((c) => !seenClipped.has(c.key));

  const seenOffscreen = new Set(control.offscreen.map((o) => o.key));
  const freshOffscreen = treatment.offscreen.filter((o) => !seenOffscreen.has(o.key));

  const report = [
    freshClipped.length
      ? `content clipped only under the override (${freshClipped.length}):\n  ${freshClipped
          .map((f) => f.detail)
          .join("\n  ")}`
      : "",
    freshOffscreen.length
      ? `controls pushed out of reach (${freshOffscreen.length}):\n  ${freshOffscreen
          .map((f) => f.detail)
          .join("\n  ")}`
      : "",
    treatment.pageOverflow - control.pageOverflow > 1
      ? `page began scrolling sideways: ${control.pageOverflow}px -> ${treatment.pageOverflow}px`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  expect(report, `${label} loses content at WCAG 1.4.12 text spacing\n${report}`).toBe("");
}

/**
 * 320 is the SC 1.4.10 reflow floor — a desktop reader at 400% zoom — and is the
 * width where the override has least room to fit. 1280 is where the wide
 * multi-column layouts live, which fail differently.
 */
for (const vp of [
  { width: 320, height: 851, name: "reflow floor", paths: routes },
  { width: 1280, height: 800, name: "desktop", paths: WIDE_ROUTES },
]) {
  test.describe(`text spacing at ${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const route of vp.paths) {
      test(`${route} survives a reader's spacing`, async ({ page }) => {
        await page.goto(route);
        await page.waitForTimeout(SETTLE_MS);
        await expectNoLossUnderTextSpacing(page, `${route} @${vp.width}px`);
      });
    }
  });
}

/**
 * The overlays never appear in the route sweep, because both are closed on load.
 * They are also the tightest boxes on the site — the terminal is
 * `max-h-[60vh] overflow-hidden` and the menu is a centred panel — so they are
 * where respaced text has least room to go. 320x256 is the full 400%-zoom
 * viewport, both axes, which is the harshest case either one sees.
 */
test.describe("overlays under a reader's spacing", () => {
  for (const vp of [
    { width: 393, height: 851, name: "phone" },
    { width: 320, height: 256, name: "400% zoom" },
  ]) {
    test(`terminal at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await openTerminalByClick(page);
      await page.waitForTimeout(1200);
      await expectNoLossUnderTextSpacing(page, `terminal @${vp.name}`);
    });

    test(`mobile menu at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await openMobileMenu(page);
      await page.waitForTimeout(1200);
      await expectNoLossUnderTextSpacing(page, `mobile menu @${vp.name}`);
    });
  }
});
