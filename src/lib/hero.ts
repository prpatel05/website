/**
 * The post page paints its hero into `container max-w-3xl` — 704 CSS px of
 * content at the widest — but `image` is the full 1200w master, so the LCP
 * element on 21 pages carries roughly 2.4x the pixels it can show at 1x.
 * `scripts/generate-images.mjs` emits a column-width WebP per hero during the
 * build and the post page names it as the small candidate.
 *
 * This repeats the path derivation in scripts/hero.mjs because the post page
 * renders in the app bundle and the generator runs in Node. The two are pinned
 * together by src/lib/__tests__/hero.test.ts.
 */

export const HERO_DIR = "/images/hero";

// `container max-w-3xl` caps the column at 768px including the container's
// 2rem of padding on each side, so 704 is the widest the image is displayed
// and covers a 1x desktop outright. 960 is the rung a phone lands on: a 393px
// viewport leaves a 329px column, which at DPR 2.75 asks for about 905 device
// px — served by the full master before this existed.
export const HERO_WIDTHS = [704, 960];

// The masters are all 1200x670. Naming the master as the widest candidate
// keeps the 2x desktop path byte-identical to what the page shipped before
// this existed, and avoids re-encoding a WebP into a same-width WebP;
// scripts/hero.mjs fails the build if a master ever comes in narrower.
export const HERO_MASTER_WIDTH = 1200;

// 704px from the point the column stops growing; below that the box is the
// viewport less the container's 2rem of padding on each side.
export const HERO_SIZES = "(min-width: 768px) 704px, calc(100vw - 4rem)";

export interface HeroImage {
  src: string;
  srcSet: string;
}

const LOCAL_IMAGE = /^\/images\/(.+)\.(?:webp|png|jpe?g)$/;

// Returns null for anything the build does not own — a remote hero, or a
// format the generator is not asked to read. Callers fall back to `image`.
export function heroFor(image: string): HeroImage | null {
  const match = LOCAL_IMAGE.exec(image);

  if (!match) {
    return null;
  }

  const url = (width: number) => `${HERO_DIR}/${match[1]}-${width}w.webp`;

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
