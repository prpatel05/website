import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { markdownHtml, renderMarkdownToHtml } from "../../../scripts/markdown-html.mjs";

const blogPost = readFileSync("src/pages/BlogPost.tsx", "utf8");
const tailwindConfig = readFileSync("tailwind.config.ts", "utf8");

describe("markdown rendered at build time", () => {
  it("renders the elements the post styles cover", () => {
    const html = renderMarkdownToHtml(
      "## Head\n\n### Sub\n\nA **bold** and *soft* line.\n\n- one\n- two\n"
    );

    expect(html).toContain("border-l-2 border-primary pl-4");
    expect(html).toContain("font-display text-xl font-bold");
    expect(html).toContain("text-muted-foreground leading-relaxed my-4");
    expect(html).toContain("space-y-2 my-6 ml-4");
    // Each bullet is a flex row with the marker in its own span; a plain <li>
    // would lose the ▸ the design uses instead of a list marker.
    expect(html).toContain('<span class="text-primary shrink-0 mt-1.5">▸</span>');
    expect(html).toContain('<strong class="text-foreground font-semibold">');
    expect(html).toContain('<em class="text-primary/80">');
  });

  // A link the reader cannot see is a citation that does not exist. Tailwind's
  // preflight resets anchors to `color: inherit; text-decoration: inherit`, so
  // an unstyled <a> inherits the paragraph exactly — same colour, same weight,
  // no underline. This guards both halves: the colour AND the underline, since
  // colour on its own fails WCAG 1.4.1.
  it("marks body links as links, not as plain text", () => {
    const html = renderMarkdownToHtml(
      "See [the source](https://example.com/paper) and [an earlier post](/blog/a-post/).\n"
    );

    const anchors = html.match(/<a [^>]*>/g) ?? [];
    expect(anchors).toHaveLength(2);
    for (const anchor of anchors) {
      expect(anchor).toContain("underline");
      expect(anchor).toContain("text-primary");
    }

    // Both destinations survive the renderer: an external citation and an
    // internal cross-link, which is the shape the related-post links use.
    expect(html).toContain('href="https://example.com/paper"');
    expect(html).toContain('href="/blog/a-post/"');
  });

  // An ordered list with no entry in the component map came out as an
  // unordered one: preflight stripped `list-style`, and the shared `li` painted
  // the same ▸ a bullet list gets. The two posts that number their steps are
  // about the sequence, so "1." carries meaning that "▸" does not.
  it("numbers an ordered list instead of bulleting it", () => {
    const html = renderMarkdownToHtml("1. first\n2. second\n3. third\n");

    const markers = [...html.matchAll(/<span class="text-primary[^"]*">([^<]+)<\/span>/g)].map(
      ([, text]) => text
    );
    expect(markers).toEqual(["1.", "2.", "3."]);
    expect(html).not.toContain("▸");
  });

  // react-markdown v10 does not tell a `li` which list it is in, so the ordinal
  // is threaded down from the `ol`. A list that starts at something other than 1
  // proves the numbers come from the markdown rather than from a hardcoded
  // counter that happens to agree with it.
  it("honours a list that does not start at one", () => {
    const html = renderMarkdownToHtml("5. five\n6. six\n");

    expect(html).toContain(">5.</span>");
    expect(html).toContain(">6.</span>");
  });

  it("still bullets an unordered list", () => {
    const html = renderMarkdownToHtml("- one\n- two\n");

    expect(html).toContain('<span class="text-primary shrink-0 mt-1.5">▸</span>');
    expect(html).not.toMatch(/>\d+\.<\/span>/);
  });

  // Four quotations from a research paper rendered identically to the author's
  // own prose — the `p` inside a blockquote is the same component as any body
  // paragraph, and preflight zeroes the wrapper's margin. Without a rule and an
  // indent, the only thing separating the paper's words from the author's was
  // the quote marks someone typed by hand.
  it("sets a quotation apart from body prose", () => {
    const html = renderMarkdownToHtml("> quoted\n\nnot quoted\n");

    expect(html).toMatch(/<blockquote class="[^"]*border-l-2[^"]*pl-6[^"]*">/);
  });

  // The site's body font is already JetBrains Mono, so an unstyled <code>
  // inherits everything that could have distinguished it: family, size and
  // colour all match the paragraph around it.
  it("gives inline code a treatment the body font does not already have", () => {
    const html = renderMarkdownToHtml("Set `constraints` first.\n");

    expect(html).toMatch(/<code class="[^"]*bg-muted[^"]*">constraints<\/code>/);
  });

  // Styling inline code is what puts `pre` in scope: a fenced block wraps a
  // <code>, so without an entry every line of it would wear the inline chip.
  // No post has a fenced block today, which is exactly why a broken one would
  // ship unnoticed — and an un-scrollable one would overflow a phone.
  it("renders a fenced block as a block, not as a row of inline chips", () => {
    const html = renderMarkdownToHtml("```js\nconst x = 1;\n```\n");

    expect(html).toMatch(/<pre[^>]*class="[^"]*overflow-x-auto[^"]*"/);
    const [, codeClass] = html.match(/<pre[^>]*>\s*<code class="([^"]*)"/) ?? [];
    expect(codeClass).toBeDefined();
    expect(codeClass).not.toContain("bg-muted");
  });

  // `overflow-x-auto` above is also a scrollable region, and at 393px a real
  // code line makes it one — unreachable and unpannable by keyboard, WCAG 2.1.1.
  // `a11y-axe.spec.ts` proves the rendered behaviour at mobile width; this pins
  // the three attributes it depends on, so dropping one fails in `npm test`
  // rather than a browser run nobody does locally. The label needs the role:
  // `aria-label` on a bare `pre` is dropped, since `generic` takes no name.
  it("puts a fenced block in the tab order, named", () => {
    const html = renderMarkdownToHtml("```sh\nnpm run build -- --mode staging\n```\n");

    const [pre] = html.match(/<pre[^>]*>/) ?? [];
    expect(pre).toContain('tabindex="0"');
    expect(pre).toContain('role="group"');
    expect(pre).toContain('aria-label="Code sample"');
  });

  it("transforms .md imports into an HTML string and leaves everything else alone", () => {
    const plugin = markdownHtml();

    const md = plugin.transform("Hello **world**.\n", "/posts/a.md");
    expect(md.code).toMatch(/^export default "/);
    expect(JSON.parse(md.code.slice("export default ".length, -1))).toContain(
      "<strong class=\"text-foreground font-semibold\">world</strong>"
    );

    expect(plugin.transform("const a = 1;", "/src/a.ts")).toBeNull();
  });

  // This renderer lives in scripts/, outside every other content glob. When it
  // was missed, a className here only worked if some .tsx happened to use the
  // same one — a new class was dropped from the stylesheet with no error, and
  // the markup pointed at a rule that did not exist.
  it("is covered by a Tailwind content glob", () => {
    expect(tailwindConfig).toContain("./scripts/**/*.mjs");
  });

  it("keeps the markdown parser out of the page", () => {
    // The whole point: the body arrives as HTML, so react-markdown must not be
    // imported by anything the browser loads.
    expect(blogPost).not.toContain("react-markdown");
    expect(blogPost).toContain("dangerouslySetInnerHTML");
  });
});
