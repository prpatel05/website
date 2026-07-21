/**
 * Fails if a post page downloads its hero more than once.
 *
 * The hero is preloaded from the head and painted from a srcSet. Those are two
 * separate candidate selections: a `<link rel=preload as=image>` that names
 * only `href` makes the scanner fetch one file while the `<img>` picks another,
 * so the page pays for the LCP element twice. The preload carries matching
 * `imagesrcset`/`imagesizes` to stop that, and those attributes reach the HTML
 * through react-helmet-async, which is a pass-through nothing else pins down.
 * Stripping either attribute from the built page turns this red.
 *
 * Runs against the prerendered dist/ over a plain static server rather than
 * `vite preview`, which hands back the SPA shell for a post URL — the head the
 * preload scanner actually sees in production only exists in dist/.
 */
import { chromium, devices } from "playwright";
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { discoverPostSlugs } from "./blog-posts.mjs";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

// Every post page renders the same hero markup, so one is enough to prove the
// wiring. Taken from discovery rather than named here, so deleting a post
// cannot leave this pointed at a page that no longer exists.
const SLUG = process.argv[2] ?? discoverPostSlugs()[0];

const server = createServer((req, res) => {
  const url = req.url.split("?")[0];
  let filePath = join(DIST, url === "/" ? "index.html" : url);
  // A post URL is a directory on disk. Serving the directory itself reads as a
  // 404 with no scripts, and every hero count comes back a convincing zero.
  const isDir = existsSync(filePath) && statSync(filePath).isDirectory();
  if (!existsSync(filePath) || isDir) {
    const indexPath = join(filePath, "index.html");
    filePath = existsSync(indexPath) ? indexPath : join(DIST, "index.html");
  }
  try {
    const body = readFileSync(filePath);
    const ext = filePath.split(".").pop();
    res.writeHead(200, {
      "Content-Type":
        { html: "text/html", js: "application/javascript", css: "text/css", webp: "image/webp", png: "image/png", svg: "image/svg+xml", xml: "application/xml", json: "application/json" }[ext] ??
        "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const cases = [
  { name: "desktop 1x (1280w, dpr 1)", opts: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 } },
  { name: "desktop 2x (1280w, dpr 2)", opts: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 } },
  { name: "Pixel 5 (393w, dpr 2.75)", opts: { ...devices["Pixel 5"] } },
];

const browser = await chromium.launch();
let failed = false;

for (const { name, opts } of cases) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  const images = [];

  page.on("request", (req) => {
    const path = new URL(req.url()).pathname;
    if (path.startsWith("/images/") && !path.includes("thumbs/")) {
      images.push(path);
    }
  });

  await page.goto(`${base}/blog/${SLUG}/`, { waitUntil: "networkidle" });

  const counts = images.reduce((acc, p) => ({ ...acc, [p]: (acc[p] ?? 0) + 1 }), {});
  const total = images.length;
  const distinct = Object.keys(counts).length;
  // Zero is a failure too: a page served wrong renders nothing and counts
  // nothing, which reads as a pass if the check only looks for "not two".
  const ok = total === 1 && distinct === 1;
  if (!ok) failed = true;

  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  console.log(`      ${total} hero request(s): ${JSON.stringify(counts)}`);

  await context.close();
}

await browser.close();
server.close();

process.exit(failed ? 1 : 0);
