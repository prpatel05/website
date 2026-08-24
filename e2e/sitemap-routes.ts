import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SITEMAP = fileURLToPath(new URL("../dist/sitemap.xml", import.meta.url));

/**
 * HTML routes from the built sitemap.
 *
 * `scripts/generate-llms.mjs` also lists `/blog/<slug>.md` citation aliases in
 * the sitemap. Those are plain-text files, not pages — axe, text-spacing, and
 * the other route fans expect a hydrated document with landmarks — so they are
 * filtered out here. The markdown aliases are covered by `seo-feed.spec.ts`.
 */
export function htmlRoutesFromSitemap(): string[] {
  return [...readFileSync(SITEMAP, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map(([, loc]) => new URL(loc).pathname)
    .filter((pathname) => !pathname.endsWith(".md"));
}
