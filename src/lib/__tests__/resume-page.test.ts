import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `/resume/` is a designed HTML page in the app (prerendered to
 * dist/resume/index.html). The PDF stays at `/resume.pdf`. The old static
 * meta-refresh stub under public/resume/ would win on GitHub Pages and block
 * the React route, so it must stay gone.
 */
const app = readFileSync(join("src", "App.tsx"), "utf8");

describe("/resume", () => {
  it("is a real route in the app", () => {
    expect(app).toMatch(/<Route path="\/resume"/);
    expect(app).toMatch(/import Resume from/);
  });

  it("no longer ships a static redirect stub", () => {
    expect(existsSync(join("public", "resume", "index.html"))).toBe(false);
  });

  it("keeps the PDF download asset", () => {
    expect(existsSync(join("public", "resume.pdf"))).toBe(true);
  });
});
