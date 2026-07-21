/**
 * Emits the derived raster variants the site loads: the archive-card
 * thumbnails in public/images/thumbs/, the column-width post heroes in
 * public/images/hero/, and the homepage portrait in public/images/portrait/.
 *
 * All three exist for the same reason. The blog archive paints each hero into
 * a 128x96 box but loaded the full 1200x670 asset to do it — about 1.0MB
 * across the archive. The post page paints that same asset into a 704px
 * column. The homepage paints a 556x556, 341KB PNG portrait into a 288px box,
 * and ships it to phones where that box is `hidden`. This resizes each source
 * once per width and the components point at the results.
 *
 * Wired into `bun run dev` and `bun run build` rather than run by hand. New
 * posts land through an unattended auto-merge routine, so a hand-run step
 * would mean every future post silently ships without a thumbnail.
 *
 * Output is gitignored: it is derived from the sources, and regenerating is
 * cheap enough (a few hundred ms, and skipped entirely when up to date) that
 * checking it in would only create a way for it to go stale.
 */
import sharp from "sharp";
import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverPosts } from "./blog-posts.mjs";
import { assertMasterWidth, HERO_QUALITY, heroTargets } from "./hero.mjs";
import { THUMBNAIL_QUALITY, thumbnailTargets } from "./thumbnails.mjs";
import {
  PORTRAIT_QUALITY,
  PORTRAIT_SOURCE,
  portraitTargets,
} from "./portrait.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(here, "..", "public");

function mtimeOrNull(path) {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return null;
  }
}

let written = 0;
let skipped = 0;

/**
 * Resizes one source into its targets, skipping any output already newer than
 * the source it came from.
 */
async function emit({ source, targets, quality, describe }) {
  const sourcePath = join(PUBLIC_DIR, source.slice(1));
  const sourceMtime = mtimeOrNull(sourcePath);

  if (sourceMtime === null) {
    throw new Error(`${describe} points at a missing asset: ${source}`);
  }

  for (const { width, publicPath } of targets) {
    const output = join(PUBLIC_DIR, publicPath.slice(1));
    const outputMtime = mtimeOrNull(output);

    if (outputMtime !== null && outputMtime >= sourceMtime) {
      skipped += 1;
      continue;
    }

    mkdirSync(dirname(output), { recursive: true });

    await sharp(sourcePath)
      // A source narrower than the target keeps its own width rather than
      // being upscaled into bytes that carry no detail.
      .resize({ width, withoutEnlargement: true })
      .webp({ quality, effort: 6 })
      .toFile(output);

    written += 1;
  }
}

const posts = discoverPosts();

for (const post of posts) {
  const targets = thumbnailTargets(post.image);

  if (targets.length === 0) {
    // A remote hero, which the build does not own. The card and the post page
    // keep using it at full size.
    continue;
  }

  await emit({
    source: post.image,
    targets,
    quality: THUMBNAIL_QUALITY,
    describe: post.slug,
  });

  // The post page's srcSet names the master itself as the wide candidate, so
  // the master has to be as wide as the descriptor claims. Checked on every
  // run rather than only when a variant is rebuilt: the claim is about the
  // master, not about whether the derived file is stale.
  const { width } = await sharp(
    join(PUBLIC_DIR, post.image.slice(1))
  ).metadata();
  assertMasterWidth({ image: post.image, width, describe: post.slug });

  await emit({
    source: post.image,
    targets: heroTargets(post.image),
    quality: HERO_QUALITY,
    describe: post.slug,
  });
}

await emit({
  source: PORTRAIT_SOURCE,
  targets: portraitTargets(),
  quality: PORTRAIT_QUALITY,
  describe: "the homepage portrait",
});

console.log(
  `Images: ${written} written, ${skipped} already up to date ` +
    `(${posts.length} posts + portrait)`
);
