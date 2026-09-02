import { test, expect } from "./fixtures";
import { renderMarkdownToHtml } from "../scripts/markdown-html.mjs";

/**
 * A long unbreakable token in a post body must not widen the page.
 *
 * A bare URL, a fully-qualified name, an error code like
 * `model_context_window_exceeded` — none of them are wrong to write, and
 * whether one breaks the page is a question of rendered width, so an author
 * drafting the markdown has no way to see it coming. At 320px, the reflow floor
 * a 1280px screen reports at 400% zoom, the pre-fix body overflowed by up to
 * 504px. That is WCAG 2.1 SC 1.4.10.
 *
 * PRA-962 fixed the inline-code case by putting `overflow-wrap: anywhere` on
 * the `code` mapping. PRA-963 measured the rest of the body and found the same
 * failure in plain prose, links, list items, blockquotes and — the case that
 * decided the shape of the fix — headings, which no per-element patch of `p`,
 * `li` and `a` would have reached. So the rule now sits on the body wrapper in
 * `BlogPost` and is inherited by everything, and this test covers the body
 * rather than one mapping. Every row below is a measured pre-fix overflow.
 *
 * Two things make it a browser test rather than a unit assertion on the class
 * string. Tailwind only compiles classes it finds in its content globs, so a
 * string check passes on a class the stylesheet never received. And the fix
 * turns on a distinction no string check can see: `li` renders as a flex row,
 * so its content span is a flex item at `min-width: auto`, floored at its
 * min-content width. `break-word` adds a break opportunity for line breaking
 * but does not feed min-content, so the list rows below were unchanged with it
 * applied — 504, 110 and 110px, identical to no fix. Only `anywhere`'s breaks
 * count toward min-content.
 *
 * Bodies are swapped into a real post page rather than shipped as fixture
 * posts, so this cannot be defeated by the content workaround that closed the
 * original failure — moving the identifier somewhere it happens to fit.
 */

const TOKEN = "model_context_window_exceeded_and_then_some";
const URL_TOKEN =
  "https://platform.example.com/docs/reference/agents/streaming/model_context_window_exceeded";
const LONG_LINE =
  "npm run build -- --mode staging --some-extremely-long-flag=value_that_keeps_going";

/** Markdown that overflowed at 320px before the fix, with the amount measured. */
const CASES = [
  { name: "bare URL in a list item", was: 504, md: `- See ${URL_TOKEN} for details.` },
  { name: "long word in a list item", was: 110, md: `- The agent hits ${TOKEN} and stalls.` },
  {
    name: "link in a list item",
    was: 110,
    md: `- See [${TOKEN}](https://example.com/${TOKEN}) here.`,
  },
  { name: "long word in an ordered list item", was: 126, md: `1. The agent hits ${TOKEN}.` },
  { name: "long word in a paragraph", was: 73, md: `A paragraph mentioning ${TOKEN} inline.` },
  { name: "bare URL in a paragraph", was: 476, md: `A paragraph mentioning ${URL_TOKEN}.` },
  { name: "long word in an h2", was: 343, md: `## Heading with ${TOKEN} in it` },
  { name: "long word in an h3", was: 223, md: `### Heading with ${TOKEN} in it` },
  { name: "long word in a blockquote", was: 108, md: `> A quotation mentioning ${TOKEN}.` },
  {
    // The one case `overflow-wrap` cannot reach at any value: `white-space:
    // pre` means the block has no break opportunities to offer, so its
    // min-content width is its longest line and the list item it sits in
    // cannot shrink past that. `min-w-0` on the content span is what fixes it,
    // and the block then scrolls in the `overflow-x-auto` region it already had.
    name: "fenced block nested in a list item",
    was: 471,
    md: `1. Run the build:\n\n   \`\`\`sh\n   ${LONG_LINE}\n   \`\`\`\n\n2. Then deploy.\n`,
  },
] as const;

/** The reflow floor: 320 CSS px, what a 1280px screen at 400% zoom reports. */
test.use({ viewport: { width: 320, height: 851 } });

test("no long token in a post body widens the page at 320px", async ({ page }) => {
  const bodies = CASES.map(({ name, md }) => ({
    name,
    html: renderMarkdownToHtml(md),
  }));

  // Guard the premise rather than assume it: if the renderer stops emitting the
  // list as flex siblings, the measurements still pass but stop covering the
  // case that actually broke.
  const listHtml = bodies.find((b) => b.name === "long word in a list item")!.html;
  expect(listHtml).toContain('<li class="flex');
  expect(listHtml).toContain(TOKEN);

  await page.goto("/blog/10x-engineer-myth/");
  await page.waitForSelector("[data-post-body]");

  const measured = await page.evaluate((cases) => {
    const host = document.querySelector("[data-post-body]") as HTMLElement;
    const results = cases.map(({ name, html }) => {
      host.innerHTML = html;
      const viewport = document.documentElement.clientWidth;
      const widest = [...host.querySelectorAll<HTMLElement>("*")]
        .map((el) => Math.round(el.getBoundingClientRect().right))
        .reduce((a, b) => Math.max(a, b), 0);
      return {
        name,
        viewport,
        overflow: document.documentElement.scrollWidth - viewport,
        widest,
      };
    });

    host.innerHTML = cases[0].html;
    const span = host.querySelector("li > span:last-child") as HTMLElement;
    return {
      results,
      overflowWrap: getComputedStyle(span).overflowWrap,
      minWidth: getComputedStyle(span).minWidth,
    };
  }, bodies);

  for (const row of measured.results) expect(row.viewport).toBe(320);

  // Asserted as one list rather than a row at a time, so a regression reports
  // every case it broke instead of stopping at the first — which is also what
  // makes the negative control legible: on a build without the fix this prints
  // all ten overflows at once. The computed styles ride along in the message
  // because they are the usual explanation.
  const overflowing = measured.results
    .map((row, i) => ({ ...row, was: CASES[i].was }))
    .filter((row) => row.overflow !== 0)
    .map(
      (row) =>
        `${row.name}: ${row.overflow}px (was ${row.was}px pre-fix, ` +
        `widest right edge ${row.widest}px)`
    );

  expect(
    overflowing,
    `overflowed the 320px viewport — li content span computed ` +
      `overflow-wrap: ${measured.overflowWrap}, min-width: ${measured.minWidth}`
  ).toEqual([]);

  // Both halves of the fix, as computed values rather than class names:
  // Tailwind only compiles classes it finds in its content globs, so a string
  // check passes on a rule the stylesheet never received. `overflow-wrap` is
  // read on the list content span, which is not the element it is declared on
  // — that is what asserts it reaches the prose by inheritance.
  expect(measured.overflowWrap).toBe("anywhere");
  expect(measured.minWidth).toBe("0px");
});

/**
 * The fenced-block case above is only fixed if the block still scrolls — a
 * `pre` squeezed to nothing would take the overflow to 0 by hiding the content
 * instead of by making it reachable. It is also the check that the inherited
 * `anywhere` did not start breaking code lines: `white-space: pre` should keep
 * the block one long unwrapped line inside its own scroller.
 */
test("a fenced block still scrolls rather than wrapping", async ({ page }) => {
  const html = renderMarkdownToHtml(`\`\`\`sh\n${LONG_LINE}\n\`\`\``);

  await page.goto("/blog/10x-engineer-myth/");
  await page.waitForSelector("[data-post-body]");

  const measured = await page.evaluate((body) => {
    const host = document.querySelector("[data-post-body]") as HTMLElement;
    host.innerHTML = body;
    const pre = host.querySelector("pre") as HTMLElement;
    return {
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      scrollable: pre.scrollWidth - pre.clientWidth,
      whiteSpace: getComputedStyle(pre).whiteSpace,
    };
  }, html);

  expect(measured.whiteSpace).toBe("pre");
  expect(measured.overflow).toBe(0);
  expect(
    measured.scrollable,
    "the code block should scroll horizontally, not wrap or clip"
  ).toBeGreaterThan(100);
});
