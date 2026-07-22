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
  // Matches the app's `path="*"` route. Written to dist/404.html, which is the
  // file GitHub Pages serves — with a real 404 status — for any URL that has no
  // page. It replaces the spa-github-pages redirect shim: that bounced every
  // unknown URL to /?/the/path, which is a soft 404 to a crawler and a homepage
  // flash to a reader.
  "/404",
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

    // Prerendered markup only helps if the browser can paint it. framer-motion
    // writes its `initial` state into the inline style, which used to ship the
    // route wrapper and the <h1> at opacity:0 — the HTML landed at ~0.8s and
    // the page did not appear until hydration finished at ~2s. src/hooks/
    // useEntrance skips the entrance on first load; this keeps a regression
    // from shipping silently.
    const hidden = [
      /<main[^>]*id="main-content"[^>]*>\s*<div[^>]*>/,
      /<h1[^>]*>/,
    ]
      .map((pattern) => html.match(pattern)?.[0])
      .filter((tag) => tag && /opacity:\s*0[;"]/.test(tag));

    if (hidden.length > 0) {
      throw new Error(
        `${route} prerendered invisible — ${hidden.join(" ")}`
      );
    }

    // Determine output path. /404 is the exception to the directory-per-route
    // rule: GitHub Pages only looks for a top-level 404.html.
    const outputFile =
      route === "/"
        ? join(DIST, "index.html")
        : route === "/404"
          ? join(DIST, "404.html")
          : join(DIST, route.replace(/^\//, ""), "index.html");

    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, html, "utf-8");
    console.log(`  Wrote ${outputFile}`);

    await page.close();
  }

  await browser.close();
  server.close();

  // GitHub Pages ignores dist/404/index.html and falls back to its own generic
  // page, so a wrong output path here would fail silently in production only.
  const notFound = join(DIST, "404.html");
  if (!existsSync(notFound) || !readFileSync(notFound, "utf-8").includes(">404<")) {
    throw new Error("dist/404.html is missing or is not the 404 page");
  }

  console.log(
    `Blocked ${blockedTelemetry} telemetry request(s) from the build.`
  );
  console.log("Prerendering complete!");
}

prerender().catch((err) => {
  console.error("Prerender failed:", err);
  process.exit(1);
});
