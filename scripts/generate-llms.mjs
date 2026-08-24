import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { discoverPosts, postDescription, postBodyMarkdown } from "./blog-posts.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");
const BLOG_DIST = join(DIST, "blog");

const SITE_URL = "https://pratik.pa.tel";
const TITLE = "Pratik Patel";
const DESCRIPTION =
  "Notes on AI agents, engineering leadership, and building software when the code is no longer the hard part.";
const AUTHOR = "Pratik Patel";

// Match generate-feed.mjs: a post dated tomorrow has not published yet, and an
// early hand-merge must not surface it to crawlers ahead of its date.
function publishCutoff(today) {
  if (Number.isNaN(new Date(`${today}T12:00:00Z`).getTime())) {
    throw new Error(`Invalid today: ${today}`);
  }
  return today;
}

function isPublished(post, cutoff) {
  return post.dateISO <= cutoff;
}

function postHtmlUrl(slug) {
  return `${SITE_URL}/blog/${slug}/`;
}

function postMarkdownUrl(slug) {
  return `${SITE_URL}/blog/${slug}.md`;
}

// YAML double-quoted string: escape backslash and quote, keep it one line.
function yamlString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function yamlList(values) {
  if (!values.length) return "[]";
  return `[${values.map((v) => yamlString(v)).join(", ")}]`;
}

// Clean markdown export for citation tools: metadata front matter + the source
// body. Served at /blog/<slug>.md next to the HTML directory route
// /blog/<slug>/ — GH Pages treats the file and the directory as distinct paths.
function markdownExport(post, body) {
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const dek = postDescription(post);
  const frontMatter = [
    "---",
    `title: ${yamlString(post.title)}`,
    `description: ${yamlString(dek)}`,
    `date: ${yamlString(post.dateISO)}`,
    `tags: ${yamlList(tags)}`,
    `canonical: ${yamlString(postHtmlUrl(post.slug))}`,
    `author: ${yamlString(AUTHOR)}`,
    "---",
    "",
  ].join("\n");

  return `${frontMatter}${body ?? ""}${body && !body.endsWith("\n") ? "\n" : ""}`;
}

function llmsTxt(posts) {
  const pages = [
    `- [Home](${SITE_URL}/): Personal site and writing by ${AUTHOR}.`,
    `- [Blog](${SITE_URL}/blog/): Full archive of published posts.`,
    `- [RSS feed](${SITE_URL}/rss.xml): Machine-readable feed of the same posts.`,
  ].join("\n");

  // Prefer the .md aliases: llms.txt is for agents that want LLM-readable
  // source, not another HTML crawl. The HTML canonical is noted after the colon.
  const postLines = posts
    .map((post) => {
      const dek = postDescription(post).replace(/\s+/g, " ").trim();
      return `- [${post.title}](${postMarkdownUrl(post.slug)}): ${dek}`;
    })
    .join("\n");

  return `# ${TITLE}

> ${DESCRIPTION}

Every post below links to a clean markdown export (/blog/<slug>.md). The
human-readable HTML lives at the matching trailing-slash URL (/blog/<slug>/).

## Pages

${pages}

## Posts

${postLines}

## Optional

- [llms-full.txt](${SITE_URL}/llms-full.txt): All post markdown concatenated for bulk ingestion.
- [Sitemap](${SITE_URL}/sitemap.xml): Full URL inventory for traditional crawlers.
`;
}

function llmsFullTxt(posts, bodies) {
  const chunks = [
    `# ${TITLE}`,
    "",
    `> ${DESCRIPTION}`,
    "",
    "Full-text markdown exports of every published post, concatenated.",
    "",
  ];

  for (const post of posts) {
    const body = bodies.get(post.slug);
    chunks.push("----------");
    chunks.push("");
    chunks.push(`# ${post.title}`);
    chunks.push("");
    chunks.push(`Source: ${postHtmlUrl(post.slug)}`);
    chunks.push(`Markdown: ${postMarkdownUrl(post.slug)}`);
    chunks.push(`Date: ${post.dateISO}`);
    chunks.push("");
    if (body) {
      chunks.push(body.trimEnd());
      chunks.push("");
    }
  }

  return chunks.join("\n");
}

function generateLlms(today) {
  const cutoff = publishCutoff(today);
  const allPosts = discoverPosts();
  const posts = allPosts.filter((post) => isPublished(post, cutoff));
  const withheld = allPosts.length - posts.length;

  if (withheld > 0) {
    console.log(`llms.txt: withholding ${withheld} future-dated post(s)`);
  }

  if (!existsSync(DIST)) {
    mkdirSync(DIST, { recursive: true });
  }
  if (!existsSync(BLOG_DIST)) {
    mkdirSync(BLOG_DIST, { recursive: true });
  }

  const bodies = new Map();
  for (const post of posts) {
    const body = postBodyMarkdown(post.slug);
    bodies.set(post.slug, body);
    const exportPath = join(BLOG_DIST, `${post.slug}.md`);
    writeFileSync(exportPath, markdownExport(post, body), "utf-8");
  }

  const llmsPath = join(DIST, "llms.txt");
  writeFileSync(llmsPath, llmsTxt(posts), "utf-8");

  const fullPath = join(DIST, "llms-full.txt");
  const full = llmsFullTxt(posts, bodies);
  writeFileSync(fullPath, full, "utf-8");

  console.log(
    `llms.txt generated: ${llmsPath} (${posts.length} posts, ${posts.length} .md aliases, llms-full.txt ${Buffer.byteLength(full, "utf-8")} bytes)`
  );
}

generateLlms(process.env.LLMS_TODAY || new Date().toISOString().slice(0, 10));
