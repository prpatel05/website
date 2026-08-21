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
 * `fonts.css` declares five faces. Three of them are JetBrains Mono (400 normal,
 * 400 italic, 700 normal) and two are Space Grotesk (400 and 700, both normal).
 * A heading — `font-display`, `font-bold` — is already on the only display
 * bold there is, and there is still no display italic. Any emphasis that
 * changed its style landed on a face that does not exist, and the browser
 * silently snapped or synthesized an oblique. Measured on `fb2f7d3`:
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
  // The four levels the renderer did not map until PRA-1005. The bare rows are
  // the point of that issue: they carry no emphasis at all, so they failed on
  // the heading's own text. The emphasis rows guard the `inHeading` threading
  // the new mappings need — without it they land on `Space Grotesk|600|normal`,
  // which is PRA-1004 reintroduced one level down.
  { name: "bare h1", md: "# Heading" },
  { name: "bare h4", md: "#### Heading" },
  { name: "bare h5", md: "##### Heading" },
  { name: "bare h6", md: "###### Heading" },
  { name: "bold in an h1", md: "# Heading with **bold** in it" },
  { name: "italic in an h1", md: "# Heading with *italic* in it" },
  { name: "nested emphasis in an h1", md: "# Heading with ***both*** in it" },
  { name: "bold in an h4", md: "#### Heading with **bold** in it" },
  { name: "italic in an h4", md: "#### Heading with *italic* in it" },
  { name: "nested emphasis in an h4", md: "#### Heading with ***both*** in it" },
  { name: "bold in an h5", md: "##### Heading with **bold** in it" },
  { name: "bold in an h6", md: "###### Heading with **bold** in it" },
  { name: "bold inside a link in an h4", md: "#### Heading with [**a link**](https://example.com)" },
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
 * Every markdown heading level, `#` through `######`, for the second test below.
 *
 * The renderer mapped `h2` and `h3` only until PRA-1005, so the other four
 * emitted bare tags and took `font-size: inherit; font-weight: inherit` from
 * Tailwind's preflight. Measured on `2f2bc06`, `#### Heading` rendered at 14px /
 * 400 with `margin: 0` — the body's own metrics — so it was not merely on an
 * undeclared face, it did not read as a heading at all.
 *
 * That half is invisible to the face test above: a heading sized like body text
 * still paints `Space Grotesk|700|normal` the moment someone gives it
 * `font-bold`, and the face assertion goes green while the type scale is wrong.
 * So the levels are measured here as well, against the paragraph they sit next
 * to rather than against hard-coded pixels — the ramp is a design choice and may
 * be retuned; "a heading outranks the prose around it" is the invariant.
 */
const LEVELS = [1, 2, 3, 4, 5, 6].map((level) => ({
  level,
  md: `${"#".repeat(level)} Heading level ${level}`,
}));


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

test("every heading level a post can contain renders as a heading", async ({ page }) => {
  // The renderer half, checked before the browser is involved: a level with no
  // entry in the component map emits a bare tag and therefore carries no class.
  // This is the cheapest possible statement of "the set is closed", and it is
  // the check that would have caught PRA-1005 at the moment the map was written.
  const rendered = LEVELS.map(({ level, md }) => ({ level, html: renderMarkdownToHtml(md) }));
  expect(
    rendered.filter((r) => !/^<h[1-6][^>]*class="/.test(r.html)).map((r) => `h${r.level}: ${r.html}`),
    `these heading levels emitted a bare tag, so the renderer has no mapping for them. ` +
      `An unmapped heading still takes font-display from src/index.css but font-size and ` +
      `font-weight from Tailwind's preflight, i.e. the body's — an undeclared face at body ` +
      `size with no margins (PRA-1005).`
  ).toEqual([]);

  await page.goto(POST);
  await page.waitForSelector("[data-post-body]");
  await page.evaluate(() => document.fonts.ready);

  // Every level plus a paragraph in one body, so the comparison is against the
  // prose as it actually renders in this container rather than against a
  // remembered pixel value.
  const html = rendered.map((r) => r.html).join("") + renderMarkdownToHtml("Ordinary prose.");
  const measured = await page.evaluate((body) => {
    const host = document.querySelector("[data-post-body]") as HTMLElement;
    host.innerHTML = body;
    void host.offsetWidth;
    const read = (el: Element) => {
      const s = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        family: s.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
        weight: Number(s.fontWeight),
        size: parseFloat(s.fontSize),
        marginTop: parseFloat(s.marginTop),
      };
    };
    return {
      headings: [...host.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(read),
      prose: read(host.querySelector("p")!),
    };
  }, html);

  expect(measured.headings, "one rendered element per markdown level").toHaveLength(LEVELS.length);

  // A body `#` renders as an `h2`: the post title above this container is the
  // page's `<h1>`, and a second one would leave a screen-reader user two
  // level-1 headings to choose between. Asserted rather than left implicit —
  // it is a deliberate renumbering, and the kind that gets "tidied" back.
  expect(
    measured.headings.map((row) => row.tag),
    "a markdown h1 should be demoted to h2; the post title owns the page's only h1"
  ).toEqual(["h2", "h2", "h3", "h4", "h5", "h6"]);

  expect(measured.prose.family, "body copy should be the display face").toBe(
    "Space Grotesk"
  );
  expect(measured.prose.weight, "body copy should be the regular display face").toBe(
    400
  );

  const failures: string[] = [];
  for (const row of measured.headings) {
    // Weight and size are what make a heading outrank prose now that both sit
    // in Space Grotesk. The original defect broke family, weight, size and
    // margin at once, and any one of them alone is still a defect.
    if (row.family !== "Space Grotesk")
      failures.push(`${row.tag}: family ${row.family}, expected Space Grotesk`);
    if (row.weight !== 700) failures.push(`${row.tag}: weight ${row.weight}, expected 700`);
    if (row.size < measured.prose.size)
      failures.push(`${row.tag}: ${row.size}px, smaller than the ${measured.prose.size}px prose`);
    if (row.marginTop <= 0) failures.push(`${row.tag}: margin-top ${row.marginTop}px`);
  }

  // The ramp itself: each level must be no larger than the one above it. `h1`
  // and `h2` share a size by construction, hence `<=` and not `<` — the size
  // axis also runs out at `h6`, which sits at the body's own size and is
  // separated from the prose by weight and colour instead.
  for (let i = 1; i < measured.headings.length; i++) {
    const [prev, cur] = [measured.headings[i - 1], measured.headings[i]];
    if (cur.size > prev.size)
      failures.push(`${cur.tag} (${cur.size}px) is larger than ${prev.tag} (${prev.size}px)`);
  }

  expect(
    failures,
    `a heading must outrank the prose around it and the levels must descend. ` +
      `Measured prose at ${measured.prose.size}px/${measured.prose.weight} ${measured.prose.family}.`
  ).toEqual([]);
});
