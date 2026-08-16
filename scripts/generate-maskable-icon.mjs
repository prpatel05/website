/**
 * Renders public/favicon-512-maskable.png from public/favicon.svg.
 *
 * A `purpose: "maskable"` icon is not shown as drawn. The launcher applies its
 * own mask — a circle on Pixel, a squircle elsewhere — and only the central 80%
 * *circle* is guaranteed to survive it. The tile that shipped before this script
 * scaled the 24-unit viewBox to 410.7px, within a pixel of 409.6 = 80% of 512:
 * the artwork had been fitted to the safe-zone **square**. But the terminal
 * frame is a rounded square, so its four corners sit further from the centre
 * than its edges do — at radius 217.9px against a safe radius of 204.8 — and a
 * circular mask sliced 13px off each corner of a stroke only 30px thick. What
 * should read as a closed window outline rendered as four disconnected arcs.
 *
 * The fix is to scale by the artwork's true bounding *circle* instead. Straight
 * from favicon.svg's geometry, the outermost point of the mark is the outer edge
 * of a corner arc:
 *
 *   rect x=3 y=3 w=18 h=18 rx=2, stroke-width 1.75 on a 0 0 24 24 viewBox
 *     corner arc centre  = (3 + 2, 3 + 2), i.e. 12 - 5 = 7 units off centre
 *     outer arc radius   = rx + half the stroke = 2 + 0.875 = 2.875 units
 *     outermost point    = hypot(7, 7) + 2.875 = 12.7745 units
 *
 * Note that exceeds the viewBox's own half-width of 12 — the mark pokes outside
 * the circle inscribed in its viewBox, which is exactly why fitting the viewBox
 * to the safe zone was not enough. Rendering the viewBox at ART_SIZE puts that
 * point at ART_SIZE / 24 * 12.7745 px, and the artwork then sits on a full-bleed
 * backdrop out to the tile edge, as a maskable icon must.
 *
 * Not wired into `bun run build`. The favicons are checked-in binaries rather
 * than derived output; this exists so the tile can be regenerated from the
 * master instead of hand-edited. The invariant it establishes — the mark stays
 * inside the safe circle, and the tile is opaque edge to edge — is guarded by
 * src/lib/__tests__/webmanifest.test.ts, which measures the shipped PNG and is
 * what actually keeps this honest.
 *
 * Run with: node scripts/generate-maskable-icon.mjs
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const publicFile = (name) =>
  fileURLToPath(new URL(`../public/${name}`, import.meta.url));

/** The tile size, and the `sizes` site.webmanifest declares for this entry. */
const TILE = 512;

/** The maskable safe zone: a centred circle of diameter 80% of the tile. */
const SAFE_RADIUS = (0.8 * TILE) / 2;

/**
 * Distance from centre to the outermost point of the mark, in viewBox units —
 * the outer edge of the rounded rect's corner arc. Derived in the header
 * comment; re-derive it if favicon.svg's rect or stroke-width ever changes.
 */
const MARK_RADIUS_UNITS = Math.hypot(7, 7) + 2.875;

/**
 * How large to render the 24-unit viewBox. The ceiling is the size at which the
 * mark is exactly tangent to the safe circle:
 *
 *   24 * SAFE_RADIUS / MARK_RADIUS_UNITS = 384.8px
 *
 * 376 leaves 2.3% of headroom under that — more than the ~1px an antialiased
 * stroke spreads past its geometric edge, and enough that a launcher whose mask
 * runs a hair inside the nominal circle still clears the corners. It also makes
 * the padding an exact 68px per side, so the mark lands dead centre with no
 * rounding. Raising it to the ceiling would buy 2% of linear size and spend all
 * the margin.
 */
const ART_SIZE = 376;

/** favicon.svg's viewBox is 0 0 24 24, and librsvg renders a viewBox at density/72 px per unit. */
const DENSITY = (72 * ART_SIZE) / 24;

/**
 * The backdrop the artwork is composited onto and which then runs to the tile
 * edge: the `fill` on favicon.svg's rounded rect. Deliberately not the
 * manifest's `background_color` (#0a0a0a) — that paints the splash screen, this
 * paints inside the artwork, and a mismatch would show as a seam where the
 * frame's antialiased edge meets the surrounding field.
 */
const BACKDROP = { r: 0x0a, g: 0x0c, b: 0x10 };

const master = sharp(readFileSync(publicFile("favicon.svg")), {
  density: DENSITY,
});

const { width, height } = await master.metadata();
if (width !== ART_SIZE || height !== ART_SIZE) {
  // Guard the density arithmetic against an edit to the master's viewBox. A
  // mis-sized render would be padded to a plausible-looking 512x512 tile
  // further down, at the wrong scale and so with the wrong safe-zone margin.
  throw new Error(
    `favicon.svg rendered ${width}x${height} at density ${DENSITY}, expected ${ART_SIZE}x${ART_SIZE} — check its viewBox`
  );
}

const pad = (TILE - ART_SIZE) / 2;
if (!Number.isInteger(pad)) {
  // An odd padding would offset the mark by half a pixel, which on a circular
  // mask costs margin on one side and hands it to the other.
  throw new Error(`ART_SIZE ${ART_SIZE} does not centre in ${TILE} — padding ${pad}`);
}

const tile = await master
  .flatten({ background: BACKDROP })
  .extend({ top: pad, bottom: pad, left: pad, right: pad, background: BACKDROP })
  // flatten/extend leave the alpha channel in place, just fully opaque. Drop it
  // outright: a maskable icon with a transparent margin is letterboxed, and the
  // mask would then cut into the artwork rather than the backdrop.
  .removeAlpha()
  .png()
  .toBuffer();

// Measure what we actually rasterised rather than trusting the arithmetic. The
// derivation above reads geometry out of a comment; this reads it out of the
// pixels, so an edit to favicon.svg that moves the mark fails here instead of
// shipping a tile whose corners get sliced off on a Pixel.
const { data, info } = await sharp(tile).raw().toBuffer({ resolveWithObject: true });
const centre = TILE / 2;
let maxRadius = 0;
for (let i = 0; i < data.length; i += info.channels) {
  const px = i / info.channels;
  const dr = data[i] - BACKDROP.r;
  const dg = data[i + 1] - BACKDROP.g;
  const db = data[i + 2] - BACKDROP.b;
  // Same threshold the test uses; see its comment for why 19.
  if (Math.hypot(dr, dg, db) < 19) continue;
  const radius = Math.hypot(
    ((px % TILE) + 0.5) - centre,
    (Math.floor(px / TILE) + 0.5) - centre
  );
  if (radius > maxRadius) maxRadius = radius;
}
if (maxRadius > SAFE_RADIUS) {
  throw new Error(
    `mark reaches radius ${maxRadius.toFixed(2)}px, outside the ${SAFE_RADIUS}px safe circle`
  );
}

await sharp(tile).toFile(publicFile("favicon-512-maskable.png"));

console.log(
  `favicon-512-maskable.png: ${TILE}x${TILE}, opaque, artwork at ${ART_SIZE}px, ` +
    `mark reaches radius ${maxRadius.toFixed(2)}px of ${SAFE_RADIUS}px safe`
);
