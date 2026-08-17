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

function post(
  slug: string,
  title: string,
  dateISO: string,
  subtitle: string,
  description?: string
) {
  return `import { BlogPost } from "./types";
export const p: BlogPost = {
  slug: ${JSON.stringify(slug)},
  title: ${JSON.stringify(title)},
  subtitle: ${JSON.stringify(subtitle)},
${description === undefined ? "" : `  description: ${JSON.stringify(description)},\n`}  date: "2026.07",
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
  // blog-automerge.sh merges a post on the morning of its dateISO, so a post
  // dated FEED_TODAY is live on the site and belongs in the feed -- the cutoff
  // is inclusive, and getting that wrong would withhold every post on the one
  // day it matters.
  writeFileSync(
    join(postsDir, "today.ts"),
    post("today-post", "Today Post", "2026-07-19", "Published this morning.")
  );
  // A post dated tomorrow has not merged yet, so it cannot be on the site. If
  // one reaches `main` early anyway, the feed must not push it to subscribers
  // ahead of its date -- a feed item cannot be recalled.
  writeFileSync(
    join(postsDir, "tomorrow.ts"),
    post("tomorrow-post", "Tomorrow Post", "2026-07-20", "Not due until tomorrow.")
  );
  writeFileSync(
    join(postsDir, "future.ts"),
    post("future-post", "Future Post", "2026-08-30", "Not due yet.")
  );
  // A reader row shows the description with no title beside it, so a post whose
  // subtitle only reads correctly under its own headline overrides it. The
  // field is optional, which the three posts above also cover: blog-posts.mjs
  // must not fail the build on its absence.
  writeFileSync(
    join(postsDir, "overridden.ts"),
    post(
      "overridden-post",
      "Overridden Post",
      "2026-07-02",
      "And Why It Matters",
      "A description written to stand on its own in a feed reader."
    )
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
    expect(titles).toEqual([
      "Today Post",
      "Newer &amp; Bolder",
      "Overridden Post",
      "Older Post",
    ]);
  });

  it("includes a post dated today, the morning auto-merge publishes it", () => {
    expect(feed).toContain("https://pratik.pa.tel/blog/today-post/");
  });

  // Until PRA-1123 the cutoff was `<= tomorrow`, matching a routine that merged
  // the day before the displayed date. It no longer does, and a feed item is
  // pushed to subscribers and cannot be recalled.
  it("withholds a post dated tomorrow, which has not been published yet", () => {
    expect(feed).not.toContain("tomorrow-post");
    expect(feed).not.toContain("Tomorrow Post");
  });

  it("withholds posts dated beyond the auto-merge window", () => {
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

  it("summarises a post from description when it has one, else subtitle", () => {
    expect(feed).toContain(
      "<description>A description written to stand on its own in a feed reader.</description>"
    );
    expect(feed).not.toContain("And Why It Matters");
    // The posts with no description still summarise from subtitle.
    expect(feed).toContain("<description>An older subtitle.</description>");
  });

  it("escapes XML-significant characters in text", () => {
    expect(feed).toContain("Quotes &quot;and&quot; ampersands &amp; such.");
    expect(feed).not.toMatch(/<description>[^<]*[&][^a-z#]/);
  });

  it("dates are RFC 822 and land on the intended day", () => {
    const dates = [...feed.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map((m) => m[1]);
    expect(dates).toEqual([
      "Sun, 19 Jul 2026 12:00:00 GMT",
      "Tue, 14 Jul 2026 12:00:00 GMT",
      "Thu, 02 Jul 2026 12:00:00 GMT",
      "Wed, 01 Jul 2026 12:00:00 GMT",
    ]);
  });

  it("stamps lastBuildDate with the build date, never a future post date", () => {
    expect(feed).toContain("<lastBuildDate>Sun, 19 Jul 2026 12:00:00 GMT</lastBuildDate>");
  });

  it("declares a self-referencing atom link", () => {
    expect(feed).toContain(
      '<atom:link href="https://pratik.pa.tel/rss.xml" rel="self" type="application/rss+xml" />'
    );
  });
});
