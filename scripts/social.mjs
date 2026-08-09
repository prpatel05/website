/**
 * The build-side half of the per-post social card.
 *
 * The hero master is WebP, which is right for the bytes the page paints and
 * wrong for the tag a scraper reads: LinkedIn's published image spec lists
 * JPG, PNG and GIF and does not include WebP. So the card stops being the
 * hero — this emits a JPEG at the 1.91:1 the OG spec asks for, and the post
 * page points `og:image` at it while the <img> keeps its WebP srcSet.
 *
 * The browser-side half is src/lib/social-cards.ts, which repeats the path
 * derivation because the post page renders in the app bundle and the generator
 * runs in Node. The two are pinned together by
 * src/lib/__tests__/social-cards.test.ts.
 */

export const SOCIAL_DIR = "/images/social";

// The masters are 1200x670, so at the same width the card is a 40px crop
// rather than a resize — no scaling, only the change of aspect.
export const SOCIAL_WIDTH = 1200;
export const SOCIAL_HEIGHT = 630;

// Higher than the hero's 82: a scraper fetches this once and then caches it
// for weeks, it is the only impression a link gets in a feed, and none of it
// is on the page's critical path.
export const SOCIAL_QUALITY = 88;

const LOCAL_IMAGE = /^\/images\/(.+)\.(?:webp|png|jpe?g)$/;

/**
 * The files the generator has to emit for one hero. Empty for anything the
 * build does not own — a remote hero, or a format sharp is not asked to read.
 */
export function socialTargets(image) {
  const match = LOCAL_IMAGE.exec(image);

  if (!match) {
    return [];
  }

  return [
    {
      publicPath: `${SOCIAL_DIR}/${match[1]}.jpg`,
      width: SOCIAL_WIDTH,
      height: SOCIAL_HEIGHT,
    },
  ];
}
