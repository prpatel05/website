// Submit the sitemap's URLs to IndexNow so Bing (and DuckDuckGo, which is
// Bing-backed) crawls new and changed pages within minutes of a deploy instead
// of waiting for an untargeted recrawl. Bing consumes IndexNow directly, which
// is the fastest lever we have for blog-post discovery.
//
// Runs from the deploy workflow AFTER the site is live, because IndexNow
// verifies the key file is reachable at https://<host>/<key>.txt before it
// accepts the URL list. This is best-effort: a failed submission logs and exits
// 0 so it can never break a deploy that otherwise succeeded.

import { readdirSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");
const HOST = "pratik.pa.tel";
const ENDPOINT = "https://api.indexnow.org/indexnow";

// The key lives only in its own key-file: public/<key>.txt whose body is
// exactly the key, copied verbatim into dist/ by Vite. Deriving it from that
// file (rather than a duplicated constant) keeps a single source of truth and
// self-validates: the filename stem must equal the file body.
function findKey() {
  // The step runs after Build today, so dist/ is always present — but
  // readdirSync throws ENOENT rather than returning empty, and an uncaught
  // throw exits non-zero, which under `bash -e` fails the deploy job after the
  // site has already shipped. Guarding keeps the best-effort promise above true.
  if (!existsSync(DIST)) return null;
  for (const name of readdirSync(DIST)) {
    const m = name.match(/^([0-9a-f]{8,128})\.txt$/i);
    if (!m) continue;
    const body = readFileSync(join(DIST, name), "utf-8").trim();
    if (body === m[1]) {
      return { key: m[1], keyLocation: `https://${HOST}/${name}` };
    }
  }
  return null;
}

function sitemapUrls() {
  const path = join(DIST, "sitemap.xml");
  if (!existsSync(path)) return [];
  const xml = readFileSync(path, "utf-8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

const found = findKey();
if (!found) {
  console.error("IndexNow: no <key>.txt in dist/, nothing to submit — skipping");
  process.exit(0);
}

const urlList = sitemapUrls();
if (urlList.length === 0) {
  console.error("IndexNow: sitemap.xml has no URLs — skipping");
  process.exit(0);
}

const payload = {
  host: HOST,
  key: found.key,
  keyLocation: found.keyLocation,
  urlList,
};

try {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const detail = await res.text().catch(() => "");
  // 200 = accepted, 202 = accepted and queued for validation. Anything else
  // (403 unverified key, 422 bad host, 429 rate limit) is logged, not fatal.
  console.log(
    `IndexNow: submitted ${urlList.length} URL(s) to ${ENDPOINT} -> ${res.status} ${res.statusText}${detail ? ` ${detail}` : ""}`
  );
} catch (err) {
  console.error(`IndexNow: submission failed (non-fatal): ${err.message}`);
}
process.exit(0);
