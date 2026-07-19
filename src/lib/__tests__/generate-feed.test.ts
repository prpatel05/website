import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

// scripts/generate-feed.mjs is what feed readers poll. Its failure modes are
// silent and unrecallable: a slashless <link> 301s and can surface as a
// duplicate item, and an item published ahead of its date cannot be withdrawn
// from a subscriber once fetched.
//
// The script resolves dist/ and the post directory from its own location, so it
// is copied into a temp repo layout and run for real rather than refactored for
// testability — same approach as generate-sitemap.test.ts.
//
// The temp dir lives inside the repo so that `import ts from "typescript"` in
// blog-posts.mjs still resolves via node_modules lookup walking up the tree.
const ROOT = process.cwd();
const SCRIPTS = ["generate-feed.mjs", "blog-posts.mjs"];

function post(slug: string, title: string, dateISO: string, subtitle: string) {
  return `import { BlogPost } from "./types";
export const p: BlogPost = {
  slug: ${JSON.stringify(slug)},
  title: ${JSON.stringify(title)},
  subtitle: ${JSON.stringify(subtitle)},
  date: "2026.07",
  dateISO: ${JSON.stringify(dateISO)},
  readTime: "5 min",
  tags: ["ai"],
  image: "/images/x.webp",
  content: \`body\`,
};
`;
}

let workDir: string;
let feed: string;

beforeAll(() => {
  workDir = mkdtempSync(join(ROOT, "feed-test-"));
  mkdirSync(join(workDir, "scripts"));
  mkdirSync(join(workDir, "dist"), { recursive: true });
  const postsDir = join(workDir, "src/data/blog-posts");
  mkdirSync(postsDir, { recursive: true });

  for (const script of SCRIPTS) {
    copyFileSync(join(ROOT, "scripts", script), join(workDir, "scripts", script));
  }

  writeFileSync(join(postsDir, "types.ts"), "export interface BlogPost {}\n");
  writeFileSync(
    join(postsDir, "older.ts"),
    post("older-post", "Older Post", "2026-07-01", "An older subtitle.")
  );
  writeFileSync(
    join(postsDir, "newer.ts"),
    post("newer-post", "Newer & Bolder", "2026-07-14", 'Quotes "and" ampersands & such.')
  );
  writeFileSync(
    join(postsDir, "future.ts"),
    post("future-post", "Future Post", "2026-08-30", "Not due yet.")
  );

  execFileSync("node", ["scripts/generate-feed.mjs"], {
    cwd: workDir,
    env: { ...process.env, FEED_TODAY: "2026-07-19" },
  });
  feed = readFileSync(join(workDir, "dist/rss.xml"), "utf-8");
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("generate-feed", () => {
  it("emits published posts newest first", () => {
    const titles = [...feed.matchAll(/<item>[\s\S]*?<title>([^<]+)<\/title>/g)].map(
      (m) => m[1]
    );
    expect(titles).toEqual(["Newer &amp; Bolder", "Older Post"]);
  });

  it("withholds posts dated after today", () => {
    expect(feed).not.toContain("future-post");
    expect(feed).not.toContain("Future Post");
  });

  it("links and guids use the canonical trailing-slash form", () => {
    const links = [...feed.matchAll(/<link>([^<]+)<\/link>/g)].map((m) => m[1]);
    const guids = [...feed.matchAll(/<guid[^>]*>([^<]+)<\/guid>/g)].map((m) => m[1]);

    for (const url of [...links, ...guids]) {
      expect(url.endsWith("/")).toBe(true);
    }
    expect(guids).toContain("https://pratik.pa.tel/blog/newer-post/");
  });

  it("escapes XML-significant characters in text", () => {
    expect(feed).toContain("Quotes &quot;and&quot; ampersands &amp; such.");
    expect(feed).not.toMatch(/<description>[^<]*[&][^a-z#]/);
  });

  it("dates are RFC 822 and land on the intended day", () => {
    const dates = [...feed.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map((m) => m[1]);
    expect(dates[0]).toBe("Tue, 14 Jul 2026 12:00:00 GMT");
    for (const d of dates) {
      expect(Number.isNaN(new Date(d).getTime())).toBe(false);
    }
  });

  it("declares a self-referencing atom link", () => {
    expect(feed).toContain(
      '<atom:link href="https://pratik.pa.tel/rss.xml" rel="self" type="application/rss+xml" />'
    );
  });
});
