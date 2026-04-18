import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");

// Import blog post slugs dynamically by reading the prerender routes
const STATIC_ROUTES = [
  { loc: "https://pratik.pa.tel/", changefreq: "monthly", priority: "1.0" },
  { loc: "https://pratik.pa.tel/blog", changefreq: "weekly", priority: "0.8" },
];

// Discover blog posts from the dist/blog directory
import { readdirSync, existsSync } from "fs";

function discoverBlogPosts() {
  const blogDir = join(DIST, "blog");
  if (!existsSync(blogDir)) return [];

  return readdirSync(blogDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      loc: `https://pratik.pa.tel/blog/${d.name}`,
      changefreq: "yearly",
      priority: "0.7",
    }));
}

function generateSitemap() {
  const blogPosts = discoverBlogPosts();
  const allRoutes = [...STATIC_ROUTES, ...blogPosts];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes
  .map(
    (r) => `  <url>
    <loc>${r.loc}</loc>
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
