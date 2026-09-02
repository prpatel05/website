import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { discoverPosts, postDescription, postBodyMarkdown } from "./blog-posts.mjs";
import { renderMarkdownToHtml } from "./markdown-html.mjs";

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

// scripts/blog-automerge.sh merges a queued post on the morning of its dateISO
// (PRA-1123), so every post on `main` is due today or earlier and the site and
// the feed agree on `<= today`.
//
// This used to be `<= tomorrow`, because merging happened the day *before* the
// displayed date; a stricter window would then have held every post back a day
// and made the feed permanently trail the pages it points at. That is no longer
// true, and the extra day is not harmless slack. A post hand-merged ahead of
// its date is an anomaly, and a feed item -- unlike a page, which can be
// corrected in place -- is pushed to subscribers and cannot be recalled, so
// early is the one direction never worth erring in.
function publishCutoff(today) {
  if (Number.isNaN(new Date(`${today}T12:00:00Z`).getTime())) {
    throw new Error(`Invalid today: ${today}`);
  }

  return today;
}

function isPublished(post, cutoff) {
  return post.dateISO <= cutoff;
}

// CDATA cannot contain the closer, so split any accidental `]]>` the way the
// XML spec requires rather than letting the item truncate.
function cdata(value) {
  return value.replaceAll("]]>", "]]]]><![CDATA[>");
}

function itemXml(post) {
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const categories = tags
    .map((tag) => `      <category>${escapeXml(tag)}</category>`)
    .join("\n");
  const markdown = postBodyMarkdown(post.slug);
  const encoded = markdown
    ? `      <content:encoded><![CDATA[${cdata(renderMarkdownToHtml(markdown))}]]></content:encoded>`
    : "";

  return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${postUrl(post.slug)}</link>
      <guid isPermaLink="true">${postUrl(post.slug)}</guid>
      <description>${escapeXml(postDescription(post))}</description>
      <dc:creator>${escapeXml(AUTHOR)}</dc:creator>${categories ? `\n${categories}` : ""}${encoded ? `\n${encoded}` : ""}
      <pubDate>${toRfc822(post.dateISO)}</pubDate>
    </item>`;
}

function generateFeed(today) {
  const cutoff = publishCutoff(today);
  const allPosts = discoverPosts();
  const posts = allPosts.filter((post) => isPublished(post, cutoff));
  const withheld = allPosts.length - posts.length;

  if (withheld > 0) {
    console.log(`Feed: withholding ${withheld} future-dated post(s)`);
  }

  const items = posts.map(itemXml).join("\n");

  // The build date, not the newest post's date: a post published a day early
  // would otherwise put a future timestamp on the channel, which validators
  // flag and some readers use to defer polling.
  const lastBuildDate = toRfc822(today);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
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
