import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * /resume is a redirect to the PDF, and it is served by exactly one thing:
 * public/resume/index.html. GitHub Pages 301s /resume to /resume/ and then
 * serves that file, so a `<Route path="/resume">` in the app is unreachable in
 * production — one existed anyway, quietly, alongside this one. The static file
 * is the implementation that survives because it is the one that works with JS
 * off and for a crawler.
 *
 * Read both files off disk. Reaching the route table through the app loader
 * would run the same Vite transform the browser gets, and a guard that reads
 * transformed output tests the transform rather than the source.
 */
const app = readFileSync(join("src", "App.tsx"), "utf8");
const stub = readFileSync(join("public", "resume", "index.html"), "utf8");

describe("/resume", () => {
  it("is redirected by the static stub", () => {
    expect(stub).toMatch(/<meta http-equiv="refresh" content="0;url=\/resume\.pdf">/);
  });

  it("has no competing route in the app", () => {
    // The control: App.tsx really is the route table this assertion read, so a
    // renamed or emptied file fails here instead of passing below by absence.
    expect(app).toMatch(/<Route path="\/blog"/);
    expect(app).not.toMatch(/<Route path="\/resume"/);
  });
});
