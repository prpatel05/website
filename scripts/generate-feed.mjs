import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { discoverPosts } from "./blog-posts.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");

const SITE_URL = "https://pratik.pa.tel";
const FEED_URL = `${SITE_URL}/rss.xml`;
const TITLE = "Pratik Patel";
const DESCRIPTION =
  "Notes on AI agents, engineering leadership, and building software when the code is no longer the hard part.";
const AUTHOR = "Pratik Patel";
const LANGUAGE = "en-us";

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Readers key on <guid>/<link>, so these must match the canonical trailing-slash
// form served by GitHub Pages. A slashless link 301s, and some readers treat the
// redirect target as a second, duplicate item.
function postUrl(slug) {
  return `${SITE_URL}/blog/${slug}/`;
}

// RSS dates are RFC 822. dateISO carries no time, so anchor to midday UTC —
// midnight would slide into the previous day for readers west of UTC and show
// posts as published a day early.
function toRfc822(dateISO) {
  const date = new Date(`${dateISO}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid dateISO: ${dateISO}`);
  }

  return date.toUTCString();
}

// A feed item is pushed to subscribers and cannot be recalled, so a post that
// somehow lands ahead of its publish date is held back rather than syndicated.
// The site itself is the softer surface: a page can be corrected in place.
function isPublished(post, today) {
  return post.dateISO <= today;
}

function generateFeed(today) {
  const allPosts = discoverPosts();
  const posts = allPosts.filter((post) => isPublished(post, today));
  const withheld = allPosts.length - posts.length;

  if (withheld > 0) {
    console.log(`Feed: withholding ${withheld} future-dated post(s)`);
  }

  const items = posts
    .map(
      (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${postUrl(post.slug)}</link>
      <guid isPermaLink="true">${postUrl(post.slug)}</guid>
      <description>${escapeXml(post.subtitle)}</description>
      <pubDate>${toRfc822(post.dateISO)}</pubDate>
    </item>`
    )
    .join("\n");

  const lastBuildDate = posts.length
    ? toRfc822(posts[0].dateISO)
    : toRfc822(today);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(TITLE)}</title>
    <link>${SITE_URL}/blog/</link>
    <description>${escapeXml(DESCRIPTION)}</description>
    <language>${LANGUAGE}</language>
    <copyright>${escapeXml(`© ${new Date(lastBuildDate).getUTCFullYear()} ${AUTHOR}`)}</copyright>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  const outputPath = join(DIST, "rss.xml");
  writeFileSync(outputPath, xml, "utf-8");
  console.log(`Feed generated: ${outputPath} (${posts.length} items)`);
}

// FEED_TODAY lets the test drive the future-dated cutoff without rewriting
// fixture dates every time the real date moves past them.
generateFeed(process.env.FEED_TODAY || new Date().toISOString().slice(0, 10));
