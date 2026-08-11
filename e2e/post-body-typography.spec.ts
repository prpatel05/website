import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect } from "./fixtures";

/**
 * A post body has to render the elements the author actually wrote.
 *
 * The build-time markdown renderer maps a fixed set of tags. Anything outside
 * that set emitted a bare element, and Tailwind's preflight then stripped the
 * browser defaults that would have made it legible — so three constructs the
 * posts already use came out as something else:
 *
 *   - `<ol>` lost `list-style` and its padding, and the shared `li` painted the
 *     same ▸ a bullet list gets. A seven-step runbook read as seven bullets.
 *   - `<blockquote>` lost its margin, and the `p` inside it is the same
 *     component as any body paragraph — so four quotations from a research
 *     paper were pixel-identical to the author's own prose.
 *   - `<code>` inherited a monospace font the whole site already uses, leaving
 *     it with no property at all that body text did not share.
 *
 * Everything here reads computed style rather than className, because the
 * failure this guards against is a rule that does not exist. This renderer
 * lives in `scripts/`, and its classes reach the stylesheet only through that
 * directory's Tailwind content glob — `tabular-nums` and `px-1.5` appear
 * nowhere in `src/`, so if that glob were dropped the markup would still carry
 * the class names and nothing would paint. An assertion on the class would pass
 * against exactly the build this is meant to catch.
 *
 * Which posts to load is derived from the built HTML rather than hardcoded, and
 * each construct asserts it found at least one page, so this cannot quietly
 * shrink to nothing when a post is edited.
 */

const DIST = fileURLToPath(new URL("../dist/blog", import.meta.url));

/** Slugs whose built body contains `tag`, read off the artifact under test. */
const postsContaining = (tag: RegExp) =>
  readdirSync(DIST, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((slug) => tag.test(readFileSync(`${DIST}/${slug}/index.html`, "utf8")));

const orderedListPosts = postsContaining(/<ol[\s>]/);
const blockquotePosts = postsContaining(/<blockquote[\s>]/);
const inlineCodePosts = postsContaining(/<code[\s>]/);

test.describe("post bodies render the markdown that was written", () => {
  test("numbered steps show numbers, not bullets", async ({ page }) => {
    expect(
      orderedListPosts,
      "no built post contains an <ol> — the coverage this test claims is gone"
    ).not.toHaveLength(0);

    for (const slug of orderedListPosts) {
      await page.goto(`/blog/${slug}/`);

      const list = page.locator("article ol").first();
      const markers = await list.evaluate((ol) => {
        const items = [...ol.querySelectorAll(":scope > li")];
        return {
          text: items.map((li) => li.firstElementChild?.textContent?.trim() ?? ""),
          // `display: flex` on the row suppresses ::marker, so the ordinal has
          // to be painted content. Prove it is really on screen.
          firstMarkerWidth: Math.round(
            items[0].firstElementChild!.getBoundingClientRect().width
          ),
          numericVariant: getComputedStyle(
            items[0].firstElementChild!
          ).fontVariantNumeric,
        };
      });

      expect(markers.text, `${slug} should number its steps`).toEqual(
        markers.text.map((_, i) => `${i + 1}.`)
      );
      expect(markers.text).not.toContain("▸");
      expect(markers.firstMarkerWidth).toBeGreaterThan(0);
      // `tabular-nums` exists nowhere in src/ — if the scripts/ content glob
      // stopped feeding Tailwind, this is the half that would go back to
      // `normal` while the class name stayed in the markup.
      expect(markers.numericVariant, `${slug}: tabular-nums did not compile`).toBe(
        "tabular-nums"
      );
    }
  });

  test("a quotation is visibly not the author's own prose", async ({ page }) => {
    expect(blockquotePosts, "no built post contains a <blockquote>").not.toHaveLength(0);

    for (const slug of blockquotePosts) {
      await page.goto(`/blog/${slug}/`);

      const measured = await page.evaluate(() => {
        const quote = document.querySelector("article blockquote")!;
        const quoted = quote.querySelector("p")!;
        // The control: a body paragraph carrying the *same* className, so the
        // only thing that can separate the two is the blockquote wrapper.
        const body = [...document.querySelectorAll("article p")].find(
          (p) => !p.closest("blockquote") && p.className === quoted.className
        )!;
        const rule = getComputedStyle(quote);
        return {
          sameClassName: quoted.className === body.className,
          borderLeftWidth: parseFloat(rule.borderLeftWidth),
          borderLeftStyle: rule.borderLeftStyle,
          borderLeftColor: rule.borderLeftColor,
          indent: Math.round(
            quoted.getBoundingClientRect().left - body.getBoundingClientRect().left
          ),
        };
      });

      // Guards the control itself: if the two paragraphs stopped sharing a
      // class, an indent could come from the paragraph rather than the quote.
      expect(measured.sameClassName).toBe(true);
      expect(measured.borderLeftWidth, `${slug}: quote has no rule`).toBeGreaterThan(0);
      expect(measured.borderLeftStyle).not.toBe("none");
      expect(measured.borderLeftColor).not.toBe("rgba(0, 0, 0, 0)");
      expect(measured.indent, `${slug}: quote is not indented`).toBeGreaterThan(0);
    }
  });

  test("inline code is distinguishable from the prose around it", async ({ page }) => {
    expect(inlineCodePosts, "no built post contains a <code>").not.toHaveLength(0);

    for (const slug of inlineCodePosts) {
      await page.goto(`/blog/${slug}/`);

      const measured = await page.evaluate(() => {
        const code = document.querySelector("article p code")!;
        const para = code.closest("p")!;
        const c = getComputedStyle(code);
        const p = getComputedStyle(para);
        return {
          // The body font is already JetBrains Mono, so this is the reason the
          // element needed a treatment of its own at all.
          fontFamilyMatchesProse: c.fontFamily === p.fontFamily,
          background: c.backgroundColor,
          proseBackground: p.backgroundColor,
          paddingLeft: parseFloat(c.paddingLeft),
        };
      });

      expect(measured.fontFamilyMatchesProse).toBe(true);
      expect(measured.background, `${slug}: code chip is not painted`).not.toBe(
        measured.proseBackground
      );
      expect(measured.background).not.toBe("rgba(0, 0, 0, 0)");
      // px-1.5, the other class with no user in src/.
      expect(measured.paddingLeft, `${slug}: px-1.5 did not compile`).toBeGreaterThan(0);
    }
  });
});
