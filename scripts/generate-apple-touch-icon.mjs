/**
 * Renders public/apple-touch-icon.png from public/favicon.svg.
 *
 * iOS does not honour alpha in a home-screen icon. It composites whatever we
 * ship onto **black**, then applies its own superellipse mask at the full tile
 * size. The tile shipped before this script was 30% fully transparent — a 13px
 * margin on all four sides — so that margin survived the mask as a black band:
 * the icon read ~14% smaller than every neighbouring app icon and was ringed in
 * #000000 against its own near-black artwork. Apple asks for an opaque,
 * full-bleed 180x180.
 *
 * favicon.svg is the master the rest of the favicon set was drawn from — a
 * straight 180px rasterisation of it lands within a mean channel delta of 0.85
 * of the tile we shipped — so the fix is to render that master and flatten it
 * onto the backdrop the artwork already uses, letting *that* run edge to edge.
 * The terminal frame keeps its designed inset rather than growing to the tile
 * border; iOS's mask would clip a frame that touched the edge, which is a worse
 * defect than the one being fixed. public/favicon-512-maskable.png already
 * ships this composition (full-bleed #0a0c10, frame inset) — this is the same
 * idea at the tighter inset an Apple mask allows.
 *
 * Not wired into `bun run build`. The favicons are checked-in binaries rather
 * than derived output and the apple tile is one of them; this exists so it can
 * be regenerated from the master instead of hand-edited. The invariant it
 * establishes — no transparent pixels — is guarded by
 * src/lib/__tests__/webmanifest.test.ts, which is what actually keeps it honest.
 *
 * Run with: node scripts/generate-apple-touch-icon.mjs
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const publicFile = (name) =>
  fileURLToPath(new URL(`../public/${name}`, import.meta.url));

/** Apple's tile size, and the `sizes` both index.html and site.webmanifest declare. */
const TILE = 180;

/** favicon.svg's viewBox is 0 0 24 24, and librsvg renders a viewBox at density/72 px per unit. */
const DENSITY = (72 * TILE) / 24;

/**
 * The backdrop to flatten onto: the `fill` on favicon.svg's rounded rect, which
 * is also what favicon-512-maskable.png already flattens onto. Deliberately not
 * the manifest's `background_color` (#0a0a0a) — that paints the splash screen,
 * this paints inside the artwork, and a mismatch would show as a seam where the
 * frame's antialiased edge meets the tile.
 */
const BACKDROP = { r: 0x0a, g: 0x0c, b: 0x10 };

const master = sharp(readFileSync(publicFile("favicon.svg")), {
  density: DENSITY,
});

const { width, height } = await master.metadata();
if (width !== TILE || height !== TILE) {
  // Guard the density arithmetic against an edit to the master's viewBox. A
  // mis-sized render would be silently resized to a 180x180 opaque tile further
  // down, so the icon would still pass every assertion while looking wrong.
  throw new Error(
    `favicon.svg rendered ${width}x${height} at density ${DENSITY}, expected ${TILE}x${TILE} — check its viewBox`
  );
}

await master
  .flatten({ background: BACKDROP })
  // flatten leaves the alpha channel in place, just fully opaque. Drop it
  // outright so the tile cannot regress to transparency by accident.
  .removeAlpha()
  .png()
  .toFile(publicFile("apple-touch-icon.png"));

console.log(`apple-touch-icon.png: ${TILE}x${TILE}, opaque, rendered from favicon.svg`);
