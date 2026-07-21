/**
 * Where a variant of the homepage portrait lives.
 *
 * This is the build-side half of the derivation. The browser-side half is
 * src/lib/portrait.ts, which has to repeat it because the Hero renders in the
 * app bundle and the generator runs in Node. The two are pinned together by
 * src/lib/__tests__/portrait.test.ts, which fails if they ever disagree.
 */

export const PORTRAIT_SOURCE = "/images/headshot.png";

export const PORTRAIT_DIR = "/images/portrait";

// The portrait box is 224px from md and 288px from lg, so 288 covers both at
// 1x. 556 is the master's own width: it is the most a 2x screen can be given,
// and asking for 576 would only name an upscale that carries no detail.
export const PORTRAIT_WIDTHS = [288, 556];

// A little above the 76 the archive thumbnails use. This one is a face that
// animates from grayscale to colour under the cursor, so it is looked at
// rather than glanced past.
export const PORTRAIT_QUALITY = 82;

const BASENAME = /^\/images\/(.+)\.(?:webp|png|jpe?g)$/.exec(PORTRAIT_SOURCE)[1];

const url = (width) => `${PORTRAIT_DIR}/${BASENAME}-${width}w.webp`;

// Smallest as the default src: it is what a browser without srcset support
// gets, and it is still enough for the box at 1x.
export function portraitVariants() {
  return {
    src: url(PORTRAIT_WIDTHS[0]),
    srcSet: PORTRAIT_WIDTHS.map((width) => `${url(width)} ${width}w`).join(", "),
  };
}

// The individual files the generator has to emit.
export function portraitTargets() {
  return PORTRAIT_WIDTHS.map((width) => ({
    width,
    publicPath: url(width),
  }));
}
