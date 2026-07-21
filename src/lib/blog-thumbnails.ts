/**
 * Archive cards paint the post hero into a 128x96 box, but `image` is the
 * full 1200x670 hero — roughly 200x the pixels the card displays, and about
 * 1.0MB across the archive. `scripts/generate-thumbnails.mjs` emits a small
 * WebP per hero during the build and the card points at that instead.
 *
 * This repeats the path derivation in scripts/thumbnails.mjs because the card
 * renders in the app bundle and the generator runs in Node. The two are pinned
 * together by src/lib/__tests__/blog-thumbnails.test.ts.
 */

// 320 covers the 128x96 desktop box at 2x with room for the object-cover
// overscan; 640 covers the full-width strip the card becomes below md.
export const THUMBNAIL_WIDTHS = [320, 640];

export const THUMBNAIL_DIR = "/images/thumbs";

// The card is 128px wide from md up. Below that it spans the container less
// the container's 2rem padding and the card's own 1.5rem padding.
export const THUMBNAIL_SIZES = "(min-width: 768px) 128px, calc(100vw - 7rem)";

export interface Thumbnail {
  src: string;
  srcSet: string;
}

const LOCAL_IMAGE = /^\/images\/(.+)\.(?:webp|png|jpe?g)$/;

// Returns null for anything the build does not own — a remote hero, or a
// format the generator is not asked to read. Callers fall back to `image`.
export function thumbnailFor(image: string): Thumbnail | null {
  const match = LOCAL_IMAGE.exec(image);

  if (!match) {
    return null;
  }

  const url = (width: number) => `${THUMBNAIL_DIR}/${match[1]}-${width}w.webp`;

  return {
    src: url(THUMBNAIL_WIDTHS[0]),
    srcSet: THUMBNAIL_WIDTHS.map((width) => `${url(width)} ${width}w`).join(
      ", "
    ),
  };
}
