import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const app = readFileSync(join("src", "App.tsx"), "utf8");
const routes = readFileSync(join("src", "routes.ts"), "utf8");
const prerender = readFileSync(join("scripts", "prerender.mjs"), "utf8");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === "__tests__") return [];
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("/book", () => {
  it("is a real, prerendered route in the app", () => {
    expect(app).toMatch(/path=\{BOOK_PATH\}/);
    expect(app).toMatch(/<BookRoute \/>/);
    expect(routes).toMatch(/BOOK_PATH = "\/book"/);
    // Lazy, and preloaded before hydration like the post page.
    expect(routes).toMatch(/lazyRoute\(\(\) => import\("\.\/pages\/Book\.tsx"\)\)/);
    expect(routes).toMatch(/matchPath\(BOOK_PATH, pathname\)/);
    expect(prerender).toMatch(/"\/book"/);
  });

  // The Cal.com loader appends embed.js the moment it runs. A static import
  // anywhere would pull it into the entry chunk and every page with it.
  it("only reaches @calcom/embed-react through a dynamic import in CalEmbed", () => {
    const users = walk("src")
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => readFileSync(f, "utf8").includes("@calcom/embed-react"));
    expect(users).toEqual([join("src", "components", "CalEmbed.tsx")]);
    const src = readFileSync(users[0], "utf8");
    expect(src).not.toMatch(/^import[^;]*["']@calcom\/embed-react["']/m);
    expect(src).toMatch(/import\("@calcom\/embed-react"\)/);
  });
});
