import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "child_process";
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "fs";
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
const POSTS = [
  { slug: "taste-is-your-moat", date: "2026-05-04" },
  { slug: "ship-it-yourself", date: "2026-06-11" },
];

const created: string[] = [];

// Runs the real script against a throwaway dist/ of prerendered post stubs.
// `today` drives the publish-day clamp through SITEMAP_TODAY.
function runSitemap(
  posts: { slug: string; date: string }[],
  today?: string
): string {
  const dir = mkdtempSync(join(tmpdir(), "sitemap-test-"));
  created.push(dir);
  mkdirSync(join(dir, "scripts"));
  copyFileSync(SCRIPT, join(dir, "scripts/generate-sitemap.mjs"));
  for (const { slug, date } of posts) {
    mkdirSync(join(dir, "dist/blog", slug), { recursive: true });
    writeFileSync(
      join(dir, "dist/blog", slug, "index.html"),
      `<meta property="article:published_time" content="${date}T12:00:00.000Z" data-rh="true">`
    );
  }

  execFileSync("node", ["scripts/generate-sitemap.mjs"], {
    cwd: dir,
    env: today ? { ...process.env, SITEMAP_TODAY: today } : process.env,
  });

  return readFileSync(join(dir, "dist/sitemap.xml"), "utf-8");
}

function lastmods(sitemap: string): Record<string, string> {
  return Object.fromEntries(
    [
      ...sitemap.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g),
    ].map((m) => [m[1], m[2]])
  );
}

let sitemap: string;

beforeAll(() => {
  sitemap = runSitemap(POSTS);
});

afterAll(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

describe("generate-sitemap", () => {
  it("discovers every prerendered post", () => {
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    // Directory discovery order is filesystem-dependent, so compare as a set.
    expect([...locs].sort()).toEqual([
      "https://pratik.pa.tel/",
      "https://pratik.pa.tel/blog/",
      "https://pratik.pa.tel/blog/series/agent-reliability/",
      "https://pratik.pa.tel/blog/ship-it-yourself/",
      "https://pratik.pa.tel/blog/taste-is-your-moat/",
    ]);
  });

  // Without <lastmod> a crawler has no signal that an old URL changed, so a
  // republished post waits for an untargeted recrawl.
  it("dates every URL from the post it was built from", () => {
    const entries = [
      ...sitemap.matchAll(
        /<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g
      ),
    ].map((m) => [m[1], m[2]]);

    expect(Object.fromEntries(entries)).toEqual({
      // Homepage and archive both list posts, so they move with the newest one.
      // The series hub is static and follows the same newest-post lastmod.
      "https://pratik.pa.tel/": "2026-06-11",
      "https://pratik.pa.tel/blog/": "2026-06-11",
      "https://pratik.pa.tel/blog/series/agent-reliability/": "2026-06-11",
      "https://pratik.pa.tel/blog/ship-it-yourself/": "2026-06-11",
      "https://pratik.pa.tel/blog/taste-is-your-moat/": "2026-05-04",
    });
  });

  it("emits no URL that GitHub Pages would redirect", () => {
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    // Directory routes need a trailing slash. File aliases (.md) must not have
    // one — a slash after a file path 404s on GitHub Pages.
    const redirecting = locs.filter(
      (loc) => !loc.endsWith("/") && !loc.endsWith(".md")
    );

    expect(redirecting).toEqual([]);
  });

  it("lists markdown aliases when generate-llms wrote them into dist", () => {
    const dir = mkdtempSync(join(tmpdir(), "sitemap-md-"));
    created.push(dir);
    mkdirSync(join(dir, "scripts"));
    copyFileSync(SCRIPT, join(dir, "scripts/generate-sitemap.mjs"));
    for (const { slug, date } of POSTS) {
      mkdirSync(join(dir, "dist/blog", slug), { recursive: true });
      writeFileSync(
        join(dir, "dist/blog", slug, "index.html"),
        `<meta property="article:published_time" content="${date}T12:00:00.000Z" data-rh="true">`
      );
      writeFileSync(join(dir, "dist/blog", `${slug}.md`), `# ${slug}\n`);
    }

    execFileSync("node", ["scripts/generate-sitemap.mjs"], { cwd: dir });
    const xml = readFileSync(join(dir, "dist/sitemap.xml"), "utf-8");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    expect([...locs].sort()).toEqual([
      "https://pratik.pa.tel/",
      "https://pratik.pa.tel/blog/",
      "https://pratik.pa.tel/blog/series/agent-reliability/",
      "https://pratik.pa.tel/blog/ship-it-yourself.md",
      "https://pratik.pa.tel/blog/ship-it-yourself/",
      "https://pratik.pa.tel/blog/taste-is-your-moat.md",
      "https://pratik.pa.tel/blog/taste-is-your-moat/",
    ]);
  });

  it("does not invent a /blog/series/ URL from a nested hub directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "sitemap-series-"));
    created.push(dir);
    mkdirSync(join(dir, "scripts"));
    copyFileSync(SCRIPT, join(dir, "scripts/generate-sitemap.mjs"));
    mkdirSync(join(dir, "dist/blog/taste-is-your-moat"), { recursive: true });
    writeFileSync(
      join(dir, "dist/blog/taste-is-your-moat/index.html"),
      `<meta property="article:published_time" content="2026-05-04T12:00:00.000Z" data-rh="true">`
    );
    // Nested hub layout the prerender writes — no index.html under series/.
    mkdirSync(join(dir, "dist/blog/series/agent-reliability"), { recursive: true });
    writeFileSync(
      join(dir, "dist/blog/series/agent-reliability/index.html"),
      "<html><title>hub</title></html>"
    );

    execFileSync("node", ["scripts/generate-sitemap.mjs"], { cwd: dir });
    const xml = readFileSync(join(dir, "dist/sitemap.xml"), "utf-8");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    expect(locs).toContain("https://pratik.pa.tel/blog/series/agent-reliability/");
    expect(locs).not.toContain("https://pratik.pa.tel/blog/series/");
    expect(locs).toContain("https://pratik.pa.tel/blog/taste-is-your-moat/");
  });

  // scripts/blog-automerge.sh publishes a post the day before the date it
  // displays, so on that deploy the prerendered article:published_time is
  // tomorrow. A <lastmod> in the future is the documented reason a crawler
  // stops trusting <lastmod> for the whole sitemap.
  describe("on the deploy that publishes a post dated tomorrow", () => {
    const TODAY = "2026-06-11";
    const PUBLISH_DAY = [
      { slug: "taste-is-your-moat", date: "2026-05-04" },
      // Merged today by the automerge cutoff, displays tomorrow's date.
      { slug: "ship-it-yourself", date: "2026-06-12" },
    ];

    it("dates no URL later than the build that produced it", () => {
      const dates = Object.entries(lastmods(runSitemap(PUBLISH_DAY, TODAY)));

      expect(dates.length).toBeGreaterThan(0);
      expect(dates.filter(([, lastmod]) => lastmod > TODAY)).toEqual([]);
    });

    it("clamps the post and the two static routes to the build date", () => {
      expect(lastmods(runSitemap(PUBLISH_DAY, TODAY))).toEqual({
        // Would have read 2026-06-12 — tomorrow — on the static routes + newest post.
        "https://pratik.pa.tel/": TODAY,
        "https://pratik.pa.tel/blog/": TODAY,
        "https://pratik.pa.tel/blog/series/agent-reliability/": TODAY,
        "https://pratik.pa.tel/blog/ship-it-yourself/": TODAY,
        // Already in the past, so it passes through untouched.
        "https://pratik.pa.tel/blog/taste-is-your-moat/": "2026-05-04",
      });
    });

    // Clamping collapses the publish-day post's date onto today, which is a
    // date another post can share. `weekly` still has to follow publication
    // order, not the clamped value, or both would claim it.
    it("still gives the tightest recrawl hint to exactly one post", () => {
      const xml = runSitemap(
        [...PUBLISH_DAY, { slug: "own-your-career", date: TODAY }],
        TODAY
      );
      // Matched per <url> block: a pattern spanning the whole document pairs
      // one entry's <loc> with a later entry's <changefreq>.
      const weekly = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)]
        .map((m) => m[1])
        .filter((block) => block.includes("<changefreq>weekly</changefreq>"))
        .map((block) => /<loc>([^<]+)<\/loc>/.exec(block)![1])
        // Directory discovery order is filesystem-dependent.
        .sort();

      expect(weekly).toEqual([
        // /blog/ and the series hub are `weekly` by definition; the newest
        // post joins them.
        "https://pratik.pa.tel/blog/",
        "https://pratik.pa.tel/blog/series/agent-reliability/",
        "https://pratik.pa.tel/blog/ship-it-yourself/",
      ]);
    });
  });
});
