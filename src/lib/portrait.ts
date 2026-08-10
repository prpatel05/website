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

// Tailwind's lg breakpoint, then md. Only ever consulted at md and up, because
// PORTRAIT_BLANK_MEDIA takes the range below it, so both branches describe a
// box that is really on screen.
export const PORTRAIT_SIZES = "(min-width: 1024px) 288px, 224px";

// Tailwind's md breakpoint, negated: the width range where the wrapper is
// `hidden` and there is no box at all.
//
// `display:none` does not cancel an eager fetch, so the portrait — the only
// image the homepage requests — used to be downloaded in full by every phone
// and painted by none of them. Worse, it picked the *larger* candidate: the
// `sizes` above resolved to 224px, which at DPR 2.75 asks for 616 device px
// and selects 556w, so the device that could not see the image took 2.2x more
// bytes than the desktop that could.
//
// A `<source>` matching this range hands the `<img>` a blank inline pixel, so
// below md there is no request at all. `loading="lazy"` would also have
// stopped it — a lazy image inside a `display:none` subtree never intersects —
// but it hides the image from the preload scanner at *every* width, and at
// exactly 768px the portrait is the LCP element: measured on a throttled
// preview of dist/, lazy moved LCP from ~810ms to ~1150ms. Gating the blank
// keeps the md-and-up path byte-for-byte and request-for-request unchanged.
export const PORTRAIT_BLANK_MEDIA = "(max-width: 767px)";

// A 1x1 transparent GIF. Inline, so "the mobile candidate" costs 43 bytes of
// markup and zero requests. It is reached only through the `<source>` above,
// which means a browser too old for `<picture>` ignores it and loads the real
// portrait from the `<img>` exactly as before — the fallback degrades to
// today's behaviour rather than to a hole.
export const PORTRAIT_BLANK =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const BASENAME = "headshot";

const url = (width: number) => `${PORTRAIT_DIR}/${BASENAME}-${width}w.webp`;

// Smallest as the default src: it is what a browser without srcset support
// gets, and it is still enough for the box at 1x.
export const PORTRAIT_SRC = url(PORTRAIT_WIDTHS[0]);

export const PORTRAIT_SRCSET = PORTRAIT_WIDTHS.map(
  (width) => `${url(width)} ${width}w`
).join(", ");
