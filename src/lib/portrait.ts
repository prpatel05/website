/**
 * The homepage Hero paints the portrait into a 224px (md) / 288px (lg) box,
 * but `/images/headshot.png` is a 556x556, 341KB master — the largest asset
 * the homepage loads, and the wrapper is `hidden md:block`, so a phone
 * downloads all of it for an image that never paints. `scripts/generate-
 * images.mjs` emits a WebP per width during the build and the Hero points at
 * those instead.
 *
 * This repeats the path derivation in scripts/portrait.mjs because the Hero
 * renders in the app bundle and the generator runs in Node. The two are pinned
 * together by src/lib/__tests__/portrait.test.ts.
 */

// The portrait box is 224px from md and 288px from lg, so 288 covers both at
// 1x. 556 is the master's own width: it is the most a 2x screen can be given,
// and asking for 576 would only name an upscale that carries no detail.
export const PORTRAIT_WIDTHS = [288, 556];

export const PORTRAIT_DIR = "/images/portrait";

// Tailwind's lg breakpoint, then md. The box is hidden below md, but the
// fetch still happens, so the smaller candidate is the one to describe.
export const PORTRAIT_SIZES = "(min-width: 1024px) 288px, 224px";

const BASENAME = "headshot";

const url = (width: number) => `${PORTRAIT_DIR}/${BASENAME}-${width}w.webp`;

// Smallest as the default src: it is what a browser without srcset support
// gets, and it is still enough for the box at 1x.
export const PORTRAIT_SRC = url(PORTRAIT_WIDTHS[0]);

export const PORTRAIT_SRCSET = PORTRAIT_WIDTHS.map(
  (width) => `${url(width)} ${width}w`
).join(", ");
