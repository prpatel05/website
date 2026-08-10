/**
 * A plain static server over dist/, for the checks that have to see what the
 * preload scanner sees.
 *
 * `vite preview` is not a substitute: it answers a post URL with the SPA shell,
 * so the prerendered head — where the preload lives — never reaches the page.
 */
import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

const TYPES = {
  html: "text/html",
  js: "application/javascript",
  css: "text/css",
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  xml: "application/xml",
  json: "application/json",
};

/** Starts the server on a free port. Resolves to `{ base, close }`. */
export async function serveDist() {
  const server = createServer((req, res) => {
    const url = req.url.split("?")[0];
    let filePath = join(DIST, url === "/" ? "index.html" : url);
    // A route URL is a directory on disk. Serving the directory itself reads as
    // a 404 with no scripts, and every request count comes back a convincing
    // zero — which is a pass for anything checking "not too many".
    const isDir = existsSync(filePath) && statSync(filePath).isDirectory();
    if (!existsSync(filePath) || isDir) {
      const indexPath = join(filePath, "index.html");
      filePath = existsSync(indexPath) ? indexPath : join(DIST, "index.html");
    }
    try {
      const body = readFileSync(filePath);
      res.writeHead(200, {
        "Content-Type":
          TYPES[filePath.split(".").pop()] ?? "application/octet-stream",
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  await new Promise((r) => server.listen(0, r));
  return {
    base: `http://localhost:${server.address().port}`,
    close: () => server.close(),
  };
}
