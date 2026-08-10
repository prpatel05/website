import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");

// Import blog post slugs dynamically by reading the prerender routes
const STATIC_ROUTES = [
  { loc: "https://pratik.pa.tel/", changefreq: "monthly", priority: "1.0" },
  // Trailing slashes are load-bearing: GitHub Pages 301-redirects the slashless
  // form of every directory route, and a sitemap full of redirects is reported
  // as "page with redirect — not indexed".
  { loc: "https://pratik.pa.tel/blog/", changefreq: "weekly", priority: "0.8" },
];

// Discover blog posts from the dist/blog directory
import { readdirSync, existsSync, readFileSync } from "fs";

// The publish date is read back out of the prerendered page rather than from
// src/data/blog-posts, so this script stays dependency-free and can be run from
// a bare dist/ (which is what the test does). A post whose page predates the
// article metadata just gets no <lastmod>, which is valid.
function publishedDate(slug) {
  const html = join(DIST, "blog", slug, "index.html");
  if (!existsSync(html)) return null;

  const match = readFileSync(html, "utf-8").match(
    /article:published_time"\s+content="(\d{4}-\d{2}-\d{2})/
  );

  return match ? match[1] : null;
}

// scripts/blog-automerge.sh merges a queued post once its dateISO is no later
// than tomorrow, so a post goes live the day *before* the date it displays. Its
// `article:published_time` is therefore tomorrow's date on the deploy that
// publishes it, and a page cannot have been last modified tomorrow.
//
// A future <lastmod> is the documented trigger for a crawler discarding the
// value — and not just on that one URL: Google treats an unreliable date as a
// reason to stop trusting <lastmod> across the whole sitemap, which is the
// entire signal this file exists to send. Worse, `newest` is copied onto / and
// /blog/ below, so one publish-day post poisoned the two highest-priority URLs
// too.
//
// The day the page actually changed is the day it shipped, so clamp to the
// build date. Every post but the one being published is already in the past and
// passes through untouched. scripts/generate-feed.mjs stamps <lastBuildDate>
// with the build date for exactly this reason.
function clampToBuildDate(dateISO, today) {
  if (!dateISO) return null;

  return dateISO > today ? today : dateISO;
}

function discoverBlogPosts() {
  const blogDir = join(DIST, "blog");
  if (!existsSync(blogDir)) return [];

  return readdirSync(blogDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      loc: `https://pratik.pa.tel/blog/${d.name}/`,
      // `yearly` tells crawlers not to bother recrawling for a year, which is
      // exactly wrong for a blog that republishes weekly. `monthly` invites a
      // recrawl cadence that matches how often a post actually changes; the
      // newest post is bumped to `weekly` below (see generateSitemap).
      changefreq: "monthly",
      priority: "0.7",
      // The date the post declares, before clamping. Which post is newest is a
      // question about publication order, so it is asked of these rather than of
      // the clamped values — clamping ties the publish-day post with anything
      // else dated today and would hand `weekly` to both.
      published: publishedDate(d.name),
    }));
}

function generateSitemap(today) {
  const blogPosts = discoverBlogPosts();
  // The homepage lists the five newest posts and /blog/ lists all of them, so
  // both change exactly when the newest post does.
  const newest = blogPosts
    .map((p) => p.published)
    .filter(Boolean)
    .sort()
    .pop();
  // The most recent post is the one still gathering links and social shares, so
  // it earns the tightest recrawl hint.
  for (const post of blogPosts) {
    if (newest && post.published === newest) post.changefreq = "weekly";
    post.lastmod = clampToBuildDate(post.published, today);
  }
  const allRoutes = [
    ...STATIC_ROUTES.map((r) => ({
      ...r,
      lastmod: clampToBuildDate(newest ?? null, today),
    })),
    ...blogPosts,
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes
  .map(
    (r) => `  <url>
    <loc>${r.loc}</loc>${r.lastmod ? `\n    <lastmod>${r.lastmod}</lastmod>` : ""}
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

  const outputPath = join(DIST, "sitemap.xml");
  writeFileSync(outputPath, xml, "utf-8");
  console.log(`Sitemap generated: ${outputPath} (${allRoutes.length} URLs)`);
}

// SITEMAP_TODAY lets the test drive the publish-day clamp without rewriting
// fixture dates every time the real date moves past them, matching FEED_TODAY
// in scripts/generate-feed.mjs.
generateSitemap(process.env.SITEMAP_TODAY || new Date().toISOString().slice(0, 10));
