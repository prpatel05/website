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

function discoverBlogPosts() {
  const blogDir = join(DIST, "blog");
  if (!existsSync(blogDir)) return [];

  return readdirSync(blogDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      loc: `https://pratik.pa.tel/blog/${d.name}/`,
      changefreq: "yearly",
      priority: "0.7",
      lastmod: publishedDate(d.name),
    }));
}

function generateSitemap() {
  const blogPosts = discoverBlogPosts();
  // The homepage lists the five newest posts and /blog/ lists all of them, so
  // both change exactly when the newest post does.
  const newest = blogPosts
    .map((p) => p.lastmod)
    .filter(Boolean)
    .sort()
    .pop();
  const allRoutes = [
    ...STATIC_ROUTES.map((r) => ({ ...r, lastmod: newest ?? null })),
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

generateSitemap();
