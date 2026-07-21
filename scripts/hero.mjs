/**
 * Where the resized variants of a post hero live.
 *
 * This is the build-side half of the derivation. The browser-side half is
 * src/lib/hero.ts, which has to repeat it because the post page renders in the
 * app bundle and the generator runs in Node. The two are pinned together by
 * src/lib/__tests__/hero.test.ts, which fails if they ever disagree about a
 * real post.
 *
 * Unlike the thumbnails and the portrait, the widest candidate is not emitted.
 * The masters are all 1200w, so re-encoding one into a same-width copy would
 * cost a generation of WebP quality to save nothing. The master is the top of
 * the candidate list; these are the rungs below it.
 */

export const HERO_DIR = "/images/hero";

// `container max-w-3xl` caps the post column at 768px including the
// container's 2rem of padding on each side, so 704 is the widest the image is
// ever displayed and covers a 1x desktop outright. 960 is the rung a phone
// lands on: a 393px viewport leaves a 329px column, which at DPR 2.75 asks for
// about 905 device px — served by the master before this existed.
export const HERO_WIDTHS = [704, 960];

// Every hero master is 1200x670, and the srcSet names the master with that
// descriptor rather than a derived copy. `assertMasterWidth` is what keeps
// that claim true — a narrower master would make the browser pick a file with
// fewer pixels than it was promised.
export const HERO_MASTER_WIDTH = 1200;

// Matches the portrait rather than the archive thumbnails: this is the LCP
// element and the only image on the page, so it is looked at rather than
// glanced past.
export const HERO_QUALITY = 82;

const LOCAL_IMAGE = /^\/images\/(.+)\.(?:webp|png|jpe?g)$/;

// Returns null for anything the build does not own — a remote hero, or a
// format sharp is not being asked to read. The post page falls back to the
// original `image` in that case, which is what it shipped before this existed.
export function heroVariants(image) {
  const match = LOCAL_IMAGE.exec(image);

  if (!match) {
    return null;
  }

  const url = (width) => `${HERO_DIR}/${match[1]}-${width}w.webp`;

  return {
    // Smallest as the default src: it is what a browser without srcset support
    // gets, and it still covers the column at 1x.
    src: url(HERO_WIDTHS[0]),
    srcSet: [
      ...HERO_WIDTHS.map((width) => `${url(width)} ${width}w`),
      `${image} ${HERO_MASTER_WIDTH}w`,
    ].join(", "),
  };
}

// The individual files the generator has to emit for one hero. The master is
// not among them — it is the source.
export function heroTargets(image) {
  const match = LOCAL_IMAGE.exec(image);

  if (!match) {
    return [];
  }

  return HERO_WIDTHS.map((width) => ({
    width,
    publicPath: `${HERO_DIR}/${match[1]}-${width}w.webp`,
  }));
}

/**
 * The srcSet hands the browser `${master} 1200w` on the strength of every
 * hero being 1200x670. A post that shipped a narrower master would have that
 * descriptor lie about it, and the browser would pick it for a box it cannot
 * fill. Failing the build names the file and the fix; the alternative is a
 * silently soft hero on one page.
 */
export function assertMasterWidth({ image, width, describe }) {
  if (width < HERO_MASTER_WIDTH) {
    throw new Error(
      `${describe}: hero ${image} is ${width}w, but post heroes must be at ` +
        `least ${HERO_MASTER_WIDTH}w — the srcSet names the master with a ` +
        `${HERO_MASTER_WIDTH}w descriptor. Re-export the hero at ` +
        `${HERO_MASTER_WIDTH}x670.`
    );
  }
}
