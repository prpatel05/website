/**
 * Emits the archive-card thumbnails into public/images/thumbs/.
 *
 * The blog archive paints each hero into a 128x96 box but loads the full
 * 1200x670 asset to do it — about 1.0MB across the archive for a column of
 * thumbnails. This resizes each hero once per width in
 * scripts/thumbnails.mjs and the card points at the result.
 *
 * Wired into `bun run dev` and `bun run build` rather than run by hand. New
 * posts land through an unattended auto-merge routine, so a hand-run step
 * would mean every future post silently ships without a thumbnail.
 *
 * Output is gitignored: it is derived from the heroes, and regenerating is
 * cheap enough (a few hundred ms, and skipped entirely when up to date) that
 * checking it in would only create a way for it to go stale.
 */
import sharp from "sharp";
import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverPosts } from "./blog-posts.mjs";
import { THUMBNAIL_QUALITY, thumbnailTargets } from "./thumbnails.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(here, "..", "public");

function mtimeOrNull(path) {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return null;
  }
}

const posts = discoverPosts();
let written = 0;
let skipped = 0;

for (const post of posts) {
  const targets = thumbnailTargets(post.image);

  if (targets.length === 0) {
    // A remote hero, which the build does not own. The card keeps using it.
    continue;
  }

  const source = join(PUBLIC_DIR, post.image.slice(1));
  const sourceMtime = mtimeOrNull(source);

  if (sourceMtime === null) {
    throw new Error(
      `${post.slug} points at a missing hero asset: ${post.image}`
    );
  }

  for (const { width, publicPath } of targets) {
    const output = join(PUBLIC_DIR, publicPath.slice(1));
    const outputMtime = mtimeOrNull(output);

    if (outputMtime !== null && outputMtime >= sourceMtime) {
      skipped += 1;
      continue;
    }

    mkdirSync(dirname(output), { recursive: true });

    await sharp(source)
      // A hero narrower than the target keeps its own width rather than being
      // upscaled into bytes that carry no detail. Every hero is 1200 wide, so
      // this is a guard rather than a case that fires.
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: THUMBNAIL_QUALITY, effort: 6 })
      .toFile(output);

    written += 1;
  }
}

console.log(
  `Thumbnails: ${written} written, ${skipped} already up to date ` +
    `(${posts.length} posts)`
);
