import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("index.html", "utf8");
const css = readFileSync("src/index.css", "utf8");

describe("font loading", () => {
  it("keeps the font stylesheet out of index.css", () => {
    // An @import here hides the font request behind our own CSS: the browser has
    // to download and parse index.css before it even learns fonts exist.
    expect(css).not.toMatch(/@import\s+url\(/);
  });

  it("links the font stylesheet from index.html with both preconnects", () => {
    expect(html).toContain("https://fonts.googleapis.com/css2?family=");
    expect(html).toContain('<link rel="preconnect" href="https://fonts.googleapis.com" />');
    // crossorigin is required: font files are fetched in CORS mode, and a
    // preconnect without it warms the wrong (credentialed) connection.
    expect(html).toContain('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />');
  });

  it("still requests the two families the design system uses", () => {
    expect(html).toContain("JetBrains+Mono");
    expect(html).toContain("Space+Grotesk");
    expect(html).toContain("display=swap");
  });
});
