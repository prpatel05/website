import { chromium } from "playwright";
import { createServer } from "http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { isTelemetryRequest } from "./telemetry-blocklist.mjs";
import { discoverPostSlugs } from "./blog-posts.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");

const ROUTES = [
  "/",
  "/blog",
  ...discoverPostSlugs().map((slug) => `/blog/${slug}`),
];

// Simple static file server for the dist folder
function startServer() {
  const mimeTypes = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".webmanifest": "application/manifest+json",
    ".xml": "application/xml",
    ".txt": "text/plain",
  };

  const server = createServer((req, res) => {
    let filePath = join(DIST, req.url === "/" ? "index.html" : req.url);

    // SPA fallback: if file doesn't exist, serve index.html
    if (!existsSync(filePath)) {
      // Check if it's a directory with index.html
      const indexPath = join(filePath, "index.html");
      if (existsSync(indexPath)) {
        filePath = indexPath;
      } else {
        filePath = join(DIST, "index.html");
      }
    }

    const ext = "." + filePath.split(".").pop();
    const contentType = mimeTypes[ext] || "application/octet-stream";

    try {
      const content = readFileSync(filePath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

async function prerender() {
  console.log("Prerendering pages with Playwright...");

  const { server, port } = await startServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // The app's analytics beacon injects a real <script src> tag, which this
  // browser would otherwise fetch and execute, reporting a pageview per route
  // per deploy into the live read-out. Keep the tag, drop the hit.
  let blockedTelemetry = 0;
  await context.route("**/*", (route) => {
    if (isTelemetryRequest(route.request().url())) {
      blockedTelemetry += 1;
      return route.abort();
    }
    return route.continue();
  });

  for (const route of ROUTES) {
    const page = await context.newPage();
    const url = `http://127.0.0.1:${port}${route}`;

    console.log(`  Rendering ${route}...`);
    await page.goto(url, { waitUntil: "networkidle" });

    // Wait for React to render meaningful content
    await page.waitForFunction(
      () => document.querySelector('#main-content')?.children.length > 0,
      { timeout: 10000 }
    ).catch(() => {
      // Fallback if the selector isn't found
      console.warn(`  Warning: hydration check timed out for ${route}, using fallback wait`);
    });

    // The post body and the post page itself are both async chunks now, so the
    // first paint can beat them. Settle the network again, then refuse to write
    // a post page whose article never arrived — an empty <article> would
    // otherwise ship as valid-looking HTML.
    await page.waitForLoadState("networkidle");

    if (route.startsWith("/blog/")) {
      const paragraphs = await page.locator("article p").count();
      if (paragraphs < 3) {
        throw new Error(
          `${route} rendered ${paragraphs} paragraph(s) — post body did not load`
        );
      }
    }

    const html = await page.content();

    // Determine output path
    const outputDir =
      route === "/" ? DIST : join(DIST, route.replace(/^\//, ""));
    const outputFile =
      route === "/" ? join(DIST, "index.html") : join(outputDir, "index.html");

    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, html, "utf-8");
    console.log(`  Wrote ${outputFile}`);

    await page.close();
  }

  await browser.close();
  server.close();
  console.log(
    `Blocked ${blockedTelemetry} telemetry request(s) from the build.`
  );
  console.log("Prerendering complete!");
}

prerender().catch((err) => {
  console.error("Prerender failed:", err);
  process.exit(1);
});
