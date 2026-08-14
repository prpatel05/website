import { test, expect } from "./fixtures";
import { renderMarkdownToHtml } from "../scripts/markdown-html.mjs";

/**
 * A long unbreakable token in inline `code` must not widen the page.
 *
 * `model_context_window_exceeded` is 29 characters, about 256px at 14px
 * JetBrains Mono once the chip's 6px of horizontal padding is counted. That
 * fits a top-level paragraph at 320px (~288px of usable width) and does not
 * fit an ordered-list item, whose marker and indent leave ~232px. On the
 * pre-fix renderer the list case pushed the document to 332px against a 320px
 * viewport — WCAG 2.1 SC 1.4.10 reflow, and the failure PRA-962 was filed for.
 *
 * The obvious fix does not work, which is the reason this test exists rather
 * than a unit assertion on the class string. `li` renders as `flex` with the
 * marker and the content in sibling spans, so the content span is a flex item
 * at `min-width: auto` — its floor is its min-content width. `overflow-wrap:
 * break-word` introduces a break opportunity for line breaking but explicitly
 * does not feed min-content, so the span keeps the full token width and the
 * page keeps overflowing: measured 12px of overflow with `break-word` applied,
 * identical to no fix at all. `anywhere` is the same rule except that its break
 * opportunities do count toward min-content, so the flex item can finally
 * shrink. Line breaking is otherwise identical between the two — a token that
 * fits on a line of its own still moves down whole under either.
 *
 * Rendering the markdown through the real renderer here, rather than pasting
 * its expected output, is what keeps this honest: the assertion is against
 * whatever `markdown-html.mjs` actually emits, measured under the real compiled
 * stylesheet in a real engine. A class that Tailwind never compiled would pass
 * a string check and fail here.
 *
 * The body is swapped into a real post page instead of shipping a fixture post,
 * so this cannot be defeated by the content workaround that closed the original
 * failure — moving the identifier to a paragraph where it happens to fit.
 */

const TOKEN = "model_context_window_exceeded";

const MARKDOWN = `Prose above the list.

1. First the agent hits \`${TOKEN}\` and stalls.
2. A second item, for the list's shape.

A top-level paragraph mentioning \`${TOKEN}\` as well.
`;

/** The reflow floor: 320 CSS px, what a 1280px screen at 400% zoom reports. */
test.use({ viewport: { width: 320, height: 851 } });

test("a long inline-code token does not widen the page at 320px", async ({
  page,
}) => {
  const html = renderMarkdownToHtml(MARKDOWN);

  // Guard the premise rather than assume it: if the renderer ever stops
  // emitting the list as flex siblings, the measurement below still passes but
  // stops covering the case that actually broke.
  expect(html).toContain("<li");
  expect(html).toContain(TOKEN);

  await page.goto("/blog/10x-engineer-myth/");
  await page.waitForSelector("[data-post-body]");

  const measured = await page.evaluate((body) => {
    const host = document.querySelector("[data-post-body]") as HTMLElement;
    host.innerHTML = body;

    const viewport = document.documentElement.clientWidth;
    const codes = [...host.querySelectorAll("code")];
    const inList = codes.find((el) => el.closest("li"));

    return {
      viewport,
      overflow: document.documentElement.scrollWidth - viewport,
      codeCount: codes.length,
      inListFound: !!inList,
      overflowWrap: inList
        ? getComputedStyle(inList).overflowWrap
        : "<no code in list>",
      widest: Math.max(
        ...codes.map((el) => Math.round(el.getBoundingClientRect().right))
      ),
    };
  }, html);

  // The premise again, from the browser's side.
  expect(measured.viewport).toBe(320);
  expect(measured.codeCount).toBe(2);
  expect(measured.inListFound).toBe(true);

  // The rule has to have survived Tailwind's content scan. Asserting the
  // computed value rather than the class name is the difference between
  // "the markup asks for this" and "the stylesheet delivers it".
  expect(measured.overflowWrap).toBe("anywhere");

  expect(
    measured.overflow,
    `page overflowed by ${measured.overflow}px at 320px; widest code right edge ${measured.widest}px`
  ).toBe(0);
});
