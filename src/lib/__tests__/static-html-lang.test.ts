import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Hand-written files under `public/` are copied verbatim and inherit nothing
 * from `index.html`, so they are the ones that can ship without `lang`
 * (WCAG 3.1.1). Routed pages get `lang` via the prerenderer.
 *
 * The former `public/resume/index.html` redirect was the original offender;
 * that path is now an app route. Any future static HTML still has to declare
 * a language.
 */
function htmlFilesUnder(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return htmlFilesUnder(path);
      return entry.name.endsWith(".html") ? [path] : [];
    });
  } catch {
    return [];
  }
}

const staticPages = htmlFilesUnder("public");

describe("static HTML under public/", () => {
  it("does not resurrect the resume redirect stub", () => {
    expect(staticPages).not.toContain(join("public", "resume", "index.html"));
  });

  it.each(staticPages.length ? staticPages : ["(none)"])(
    "%s declares a document language when present",
    (path) => {
      if (path === "(none)") {
        expect(staticPages).toEqual([]);
        return;
      }
      const html = readFileSync(path, "utf8");
      expect(html).toMatch(/<html[^>]*\slang="en"/);
    }
  );
});
