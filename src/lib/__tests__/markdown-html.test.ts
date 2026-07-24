import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { markdownHtml, renderMarkdownToHtml } from "../../../scripts/markdown-html.mjs";

const blogPost = readFileSync("src/pages/BlogPost.tsx", "utf8");

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

  it("transforms .md imports into an HTML string and leaves everything else alone", () => {
    const plugin = markdownHtml();

    const md = plugin.transform("Hello **world**.\n", "/posts/a.md");
    expect(md.code).toMatch(/^export default "/);
    expect(JSON.parse(md.code.slice("export default ".length, -1))).toContain(
      "<strong class=\"text-foreground font-semibold\">world</strong>"
    );

    expect(plugin.transform("const a = 1;", "/src/a.ts")).toBeNull();
  });

  it("keeps the markdown parser out of the page", () => {
    // The whole point: the body arrives as HTML, so react-markdown must not be
    // imported by anything the browser loads.
    expect(blogPost).not.toContain("react-markdown");
    expect(blogPost).toContain("dangerouslySetInnerHTML");
  });
});
