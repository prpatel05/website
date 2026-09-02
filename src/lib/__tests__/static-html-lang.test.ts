import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every page the site serves needs a `lang` (WCAG 3.1.1) or a screen reader
 * falls back to the system voice. The 26 routed pages inherit it from
 * `index.html` via the prerenderer; hand-written files under `public/` are
 * copied verbatim and inherit nothing, so they are the ones that can drift.
 * `/resume/index.html` did exactly that and was the only page on the site
 * shipping without one.
 *
 * Read off disk rather than through any loader: Vite copies `public/`
 * byte-for-byte, so the file here is what the browser gets.
 */
function htmlFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFilesUnder(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

const staticPages = htmlFilesUnder("public");

describe("static HTML under public/", () => {
  it("has pages to check, so the suite cannot pass by finding nothing", () => {
    expect(staticPages).toContain(join("public", "resume", "index.html"));
  });

  it.each(staticPages)("%s declares a document language", (path) => {
    const html = readFileSync(path, "utf8");
    expect(html).toMatch(/<html[^>]*\slang="en"/);
  });
});
