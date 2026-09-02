import { describe, expect, it } from "vitest";
import { renderMarkdownToHtml } from "../../../scripts/markdown-html.mjs";
import { activeHeadingId, tocFromHtml } from "../post-toc";

describe("tocFromHtml", () => {
  it("lists H2s in document order and skips H3s", () => {
    const html = renderMarkdownToHtml(
      "## First\n\n### Nested\n\n## Second\n"
    );
    expect(tocFromHtml(html)).toEqual([
      { id: "first", text: "First" },
      { id: "second", text: "Second" },
    ]);
  });

  it("returns nothing when the body has no H2s", () => {
    expect(tocFromHtml(renderMarkdownToHtml("Just a paragraph.\n"))).toEqual([]);
  });

  it("keeps emphasis out of the slug but in the label", () => {
    const html = renderMarkdownToHtml("## What the **16%** Is\n");
    expect(tocFromHtml(html)).toEqual([
      { id: "what-the-16-is", text: "What the 16% Is" },
    ]);
  });
});

describe("activeHeadingId", () => {
  const headings = [
    { id: "one", top: 120 },
    { id: "two", top: 40 },
    { id: "three", top: -20 },
  ];

  it("picks the last heading that has crossed the mark", () => {
    expect(activeHeadingId(headings, 96)).toBe("three");
  });

  it("stays on the first heading before any have crossed", () => {
    expect(
      activeHeadingId(
        [
          { id: "one", top: 200 },
          { id: "two", top: 400 },
        ],
        96
      )
    ).toBe("one");
  });

  it("is empty when there are no headings", () => {
    expect(activeHeadingId([], 96)).toBe("");
  });
});
