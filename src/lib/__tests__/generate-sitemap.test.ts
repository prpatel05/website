import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// scripts/generate-sitemap.mjs is what search engines are handed. Its failure
// mode is a sitemap of redirects: GitHub Pages 301s the slashless form of every
// directory route, so a slashless <loc> is reported as "page with redirect —
// not indexed" and the URL never lands.
//
// The script resolves its dist/ from its own location, so it is copied into a
// temp repo layout and run for real rather than refactored for testability.

// jsdom rewrites import.meta.url, so resolve from the vitest root instead.
const SCRIPT = join(process.cwd(), "scripts/generate-sitemap.mjs");
const SLUGS = ["taste-is-your-moat", "ship-it-yourself"];

let workDir: string;
let sitemap: string;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "sitemap-test-"));
  mkdirSync(join(workDir, "scripts"));
  copyFileSync(SCRIPT, join(workDir, "scripts/generate-sitemap.mjs"));
  for (const slug of SLUGS) {
    mkdirSync(join(workDir, "dist/blog", slug), { recursive: true });
  }

  execFileSync("node", ["scripts/generate-sitemap.mjs"], { cwd: workDir });
  sitemap = readFileSync(join(workDir, "dist/sitemap.xml"), "utf-8");
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("generate-sitemap", () => {
  it("discovers every prerendered post", () => {
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    // Directory discovery order is filesystem-dependent, so compare as a set.
    expect([...locs].sort()).toEqual([
      "https://pratik.pa.tel/",
      "https://pratik.pa.tel/blog/",
      "https://pratik.pa.tel/blog/ship-it-yourself/",
      "https://pratik.pa.tel/blog/taste-is-your-moat/",
    ]);
  });

  it("emits no URL that GitHub Pages would redirect", () => {
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const redirecting = locs.filter((loc) => !loc.endsWith("/"));

    expect(redirecting).toEqual([]);
  });
});
