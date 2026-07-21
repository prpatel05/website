/**
 * Where an archive thumbnail lives for a given post hero.
 *
 * This is the build-side half of the derivation. The browser-side half is
 * src/lib/blog-thumbnails.ts, which has to repeat it because the card renders
 * in the app bundle and the generator runs in Node. The two are pinned
 * together by src/lib/__tests__/blog-thumbnails.test.ts, which fails if they
 * ever disagree about a real post.
 */

// 320 covers the 128x96 desktop box at 2x with room for the object-cover
// overscan; 640 covers the full-width strip the card becomes below md.
export const THUMBNAIL_WIDTHS = [320, 640];

export const THUMBNAIL_DIR = "/images/thumbs";

export const THUMBNAIL_QUALITY = 76;

const LOCAL_IMAGE = /^\/images\/(.+)\.(?:webp|png|jpe?g)$/;

// Returns null for anything the build does not own — a remote hero, or a
// format sharp is not being asked to read. The card falls back to the original
// `image` in that case.
export function thumbnailFor(image) {
  const match = LOCAL_IMAGE.exec(image);

  if (!match) {
    return null;
  }

  const url = (width) => `${THUMBNAIL_DIR}/${match[1]}-${width}w.webp`;

  return {
    src: url(THUMBNAIL_WIDTHS[0]),
    srcSet: THUMBNAIL_WIDTHS.map((width) => `${url(width)} ${width}w`).join(
      ", "
    ),
  };
}

// The individual files the generator has to emit for one hero.
export function thumbnailTargets(image) {
  const match = LOCAL_IMAGE.exec(image);

  if (!match) {
    return [];
  }

  return THUMBNAIL_WIDTHS.map((width) => ({
    width,
    publicPath: `${THUMBNAIL_DIR}/${match[1]}-${width}w.webp`,
  }));
}
