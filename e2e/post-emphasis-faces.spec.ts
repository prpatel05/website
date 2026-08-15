import { test, expect } from "./fixtures";
import { renderMarkdownToHtml } from "../scripts/markdown-html.mjs";
import { collectFaces, declaredFaces, ours } from "./font-face-probe";

/**
 * Every font face the markdown renderer can paint is one `src/styles/fonts.css`
 * declares — for any post, not just the posts that exist today.
 *
 * `font-faces.spec.ts` already asserts this, and cannot see the failure. It
 * fans out over `dist/sitemap.xml` and measures the resting pages of the posts
 * that happen to be queued, so it is a parity check on the sample rather than
 * on the renderer. It goes red the first time a post puts emphasis in a
 * heading — which today is never: all 17 blog branches carrying a `content/*.md`
 * were scanned for the three forms and none of them use one (PRA-1004).
 *
 * That is the same accidental green `post-text-wrap.spec.ts` (#141) was written
 * to remove, and this file has the same shape: render the forms through the
 * real renderer, inject them into `[data-post-body]` on a real post route, and
 * read back what the browser resolves. Constant-time in post count, and it
 * constrains the renderer instead of anyone's prose.
 *
 * ## What was broken
 *
 * `fonts.css` declares five faces. Four of them are JetBrains Mono (400 normal,
 * 400 italic, 600 normal, 700 normal) and exactly one is Space Grotesk: 700
 * normal. So a heading — `font-display`, `font-bold` — has *no* second face to
 * move to. Any emphasis that changed its weight or its style landed on a face
 * that does not exist, and the browser silently snapped to a neighbouring
 * weight or synthesized an oblique. Measured on `fb2f7d3`:
 *
 *   `## Heading with **bold**`   -> Space Grotesk|600|normal   (strong hard-set 600)
 *   `## Heading with *italic*`   -> Space Grotesk|700|italic   (no such italic exists)
 *   `## Heading with ***both***` -> Space Grotesk|600|italic   (both at once)
 *   `Prose with ***both*** in it.` -> JetBrains Mono|600|italic (italic is 400-only)
 *
 * The heading `**bold**` case was a *de-emphasis* on top of being undeclared:
 * `strong` set 600 against the heading's 700, so asking for bold made the text
 * lighter.
 *
 * ## Why "just declare the missing faces" is not the fix
 *
 * `font-faces.spec.ts` asserts the other direction too — *every declared face
 * is actually painted somewhere* — because an unpainted declaration is the 30KB
 * defect that spec exists to prevent. Adding Space Grotesk italic/600 and
 * JetBrains Mono italic-600 would turn that test red the moment they were
 * added. The constraint is real in both directions, so it has to be the
 * renderer that changes.
 *
 * ## Why the check is not a string assertion on the class names
 *
 * The painted face is not a function of any one element's classes. It is what
 * the cascade resolves after the heading's family and weight, the UA
 * stylesheet's `em { font-style: italic }`, and every className between them
 * have all applied — three cases above are undeclared only because of what they
 * *inherit*. Tailwind also only compiles classes it finds in its content globs,
 * so a class-string check passes on a rule the stylesheet never received.
 */

/**
 * Emphasis in every container the renderer maps, in both nesting orders, and
 * through the two elements that can sit between a heading and its emphasis.
 *
 * The link and `code` rows are not padding: `a` and `em` are the two mapped
 * components that can hold a `strong` below a heading, so they are where a fix
 * that only looks at a heading's direct children fails. Everything from
 * `**bold** in a paragraph` down was already clean on `fb2f7d3` and is here to
 * stay that way — a fix for the headings must not push a working form off a
 * declared face.
 */
const FORMS = [
  { name: "bold in an h2", md: "## Heading with **bold** in it" },
  { name: "italic in an h2", md: "## Heading with *italic* in it" },
  { name: "nested emphasis in an h2", md: "## Heading with ***both*** in it" },
  { name: "italic inside bold in an h2", md: "## Heading with **bold *and italic* here**" },
  { name: "bold in an h3", md: "### Heading with **bold** in it" },
  { name: "italic in an h3", md: "### Heading with *italic* in it" },
  { name: "nested emphasis in an h3", md: "### Heading with ***both*** in it" },
  { name: "bold inside a link in an h2", md: "## Heading with [**a link**](https://example.com)" },
  { name: "italic inside a link in an h2", md: "## Heading with [*a link*](https://example.com)" },
  { name: "code in an h2", md: "## Heading with `code` in it" },
  { name: "bold in a paragraph", md: "Prose with **bold** in it." },
  { name: "italic in a paragraph", md: "Prose with *italic* in it." },
  { name: "nested emphasis in a paragraph", md: "Prose with ***both*** in it." },
  { name: "italic inside bold in a paragraph", md: "Prose with **bold *and italic* here**." },
  { name: "code inside italic in a paragraph", md: "Prose with *`code`* in it." },
  { name: "nested emphasis inside a link", md: "See [***both***](https://example.com) here." },
  { name: "emphasis in a bullet", md: "- A bullet with **bold** and *italic*." },
  { name: "nested emphasis in a bullet", md: "- A bullet with ***both*** in it." },
  { name: "nested emphasis in an ordered row", md: "1. A step with ***both*** in it." },
  { name: "nested emphasis in a blockquote", md: "> A quotation with ***both*** in it." },
] as const;

/**
 * Known gap, deliberately not covered here: `h1` and `h4`-`h6` (PRA-1005).
 *
 * The renderer maps `h2` and `h3` only, so the others emit bare tags — and
 * `src/index.css` puts *every* `h1..h6` in `font-display` while preflight sets
 * `font-weight: inherit`, so they paint `Space Grotesk|400|normal`, which is
 * not declared either. Adding
 *
 *   { name: "emphasis in an unmapped h1", md: "# Heading with **bold**" },
 *
 * to `FORMS` reproduces it, and it was measured that way before being pulled
 * back out. It is filed rather than fixed here because it is not an emphasis
 * bug — `# Heading` alone is enough — and closing it means choosing a type
 * scale for `h4`-`h6`, which is a design call and not this file's business.
 * No post on any branch uses those levels (531 content files scanned).
 */


const DECLARED = declaredFaces();
const FAMILIES = new Set([...DECLARED].map((f) => f.split("|")[0]));

/** Any post will do — the rule under test is the renderer's, not this post's. */
const POST = "/blog/10x-engineer-myth/";

test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "chromium",
    "the renderer emits one HTML string for every viewport, so the device profile re-measures identical work"
  );
});

test("no emphasis a post can contain paints an undeclared font face", async ({ page }) => {
  const bodies = FORMS.map(({ name, md }) => ({ name, html: renderMarkdownToHtml(md) }));

  // Guard the premise. Every assertion below is "the faces this body painted
  // are a subset of the declared set", which an empty measurement satisfies
  // vacuously — so if react-markdown stopped emitting `<strong>`/`<em>` for
  // these forms, the whole file would pass while testing nothing.
  const nested = bodies.find((b) => b.name === "nested emphasis in a paragraph")!.html;
  expect(nested, "`***both***` should still render as <em> wrapping <strong>").toContain(
    "<em class="
  );
  expect(nested).toContain("<strong class=");

  await page.goto(POST);
  await page.waitForSelector("[data-post-body]");
  // The faces resolve from the stylesheet, not from the downloaded files, so
  // this is not waiting for a paint — but an unloaded face is one more way to
  // read a weight the page never asked for, and `document.fonts.ready` is what
  // `font-faces.spec.ts` uses for the same reason.
  await page.evaluate(() => document.fonts.ready);

  // Swapped in one body at a time and measured with the same `collectFaces`
  // `font-faces.spec.ts` runs, passed to `page.evaluate` directly rather than
  // reconstituted inside the page — the probe stays one definition, and there
  // is no `eval` for a CSP to refuse.
  const measured: { name: string; faces: string[] }[] = [];
  for (const { name, html } of bodies) {
    await page.evaluate((body) => {
      const host = document.querySelector("[data-post-body]") as HTMLElement;
      host.innerHTML = body;
      void host.offsetWidth; // force style resolution before reading it back
    }, html);
    measured.push({ name, faces: await page.evaluate(collectFaces, "[data-post-body]") });
  }

  // Positive control on the probe itself, not just on the renderer: a form that
  // paints nothing reports the same clean empty set as a form that paints only
  // declared faces, and the two must not be confusable.
  for (const row of measured) {
    expect(
      row.faces.length,
      `the probe saw no painted text at all for "${row.name}" — it measured nothing, ` +
        `so a clean result here would be vacuous`
    ).toBeGreaterThan(0);
  }

  const offenders = measured
    .map((row) => ({ ...row, bad: ours(row.faces, FAMILIES).filter((f) => !DECLARED.has(f)) }))
    .filter((row) => row.bad.length > 0);

  // Reported as one list rather than a row at a time, so a regression prints
  // every form it broke instead of stopping at the first — and so the declared
  // set is in the message, which is always the next thing anyone reads.
  expect(
    offenders.map((row) => `${row.name}: ${row.bad.join(", ")}`),
    `these emphasis forms paint a face fonts.css does not declare, so the browser ` +
      `snaps to a neighbouring weight or synthesizes an oblique with nothing going red. ` +
      `Declared: ${[...DECLARED].sort().join(", ")}. ` +
      `Adding the missing faces is not the fix — see the header of this file.`
  ).toEqual([]);
});
