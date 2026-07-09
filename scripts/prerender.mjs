import { chromium } from "playwright";
import { createServer } from "http";
import {
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import ts from "typescript";
import { isTelemetryRequest } from "./telemetry-blocklist.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");
const BLOG_POSTS_DIR = join(__dirname, "..", "src", "data", "blog-posts");
const BLOG_POSTS_NON_POST_FILES = new Set(["index.ts", "types.ts"]);

function getPropertyName(name) {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }

  return null;
}

function readSourceFile(filePath) {
  return ts.createSourceFile(
    filePath,
    readFileSync(filePath, "utf-8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
}

function findPostSlug(filePath) {
  const sourceFile = readSourceFile(filePath);
  let slug;

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      const slugProperty = node.initializer.properties.find(
        (property) =>
          ts.isPropertyAssignment(property) &&
          getPropertyName(property.name) === "slug" &&
          ts.isStringLiteralLike(property.initializer)
      );

      if (slugProperty && ts.isPropertyAssignment(slugProperty)) {
        slug = slugProperty.initializer.text;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!slug) {
    throw new Error(`Could not find slug in ${filePath}`);
  }

  return slug;
}

// Mirrors the import.meta.glob discovery in src/data/blog-posts/index.ts, so a
// new post is prerendered without touching any shared file.
function discoverBlogRoutes() {
  const postFiles = readdirSync(BLOG_POSTS_DIR)
    .filter(
      (name) => name.endsWith(".ts") && !BLOG_POSTS_NON_POST_FILES.has(name)
    )
    .sort();

  if (postFiles.length === 0) {
    throw new Error(`Could not discover blog posts from ${BLOG_POSTS_DIR}`);
  }

  return postFiles.map(
    (name) => `/blog/${findPostSlug(join(BLOG_POSTS_DIR, name))}`
  );
}

const ROUTES = [
  "/",
  "/blog",
  ...discoverBlogRoutes(),
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
