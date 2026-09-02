/**
 * Share-card assets and their intrinsic sizes.
 *
 * Declaring og:image:width/height lets the first scrape pick the large-card
 * layout without refetching the image, but a declared size that disagrees with
 * the file is worse than none at all — so these live in one place and
 * `social-cards.test.ts` asserts every referenced file actually matches.
 */

/**
 * The site-wide card: the homepage and the /blog/ archive both share it. Neither
 * page is *about* one article, so neither should borrow an article's image —
 * the archive used to take whichever post was newest, which meant every publish
 * silently changed what an already-shared /blog/ link previewed as.
 * Regenerate with `node scripts/generate-social-card.mjs`.
 */
export const SITE_CARD = {
  url: "https://pratik.pa.tel/images/social-card.png",
  width: 1200,
  height: 630,
} as const;

/**
 * Where the per-post cards land. They are derived from the hero masters by
 * scripts/generate-images.mjs and gitignored, like every other variant.
 */
export const SOCIAL_DIR = "/images/social";

/**
 * Every post card is emitted at this size — the 1.91:1 that Facebook,
 * LinkedIn, X, Slack and Discord all render without cropping. The hero masters
 * it is cropped from are 1200x670 (1.79:1).
 */
export const BLOG_POST_CARD = {
  width: 1200,
  height: 630,
} as const;

const LOCAL_IMAGE = /^\/images\/(.+)\.(?:webp|png|jpe?g)$/;

/**
 * The card a scraper should read for a post, which is deliberately not the
 * post's hero.
 *
 * The heroes are WebP because that is right for the bytes the page paints. It
 * is wrong for `og:image`: LinkedIn's published image spec lists JPG, PNG and
 * GIF and does not include WebP, and LinkedIn is where these posts go. The
 * homepage card was already a PNG; only the posts handed scrapers the WebP
 * master. So the build emits a JPEG card per hero and the post page names that
 * in its meta tags, while the <img> keeps its WebP srcSet — nothing the
 * browser loads changes.
 *
 * The path derivation is repeated in scripts/social.mjs, because the post page
 * renders in the app bundle and the generator runs in Node. social-cards.test
 * fails if the two ever disagree.
 *
 * Returns null for a hero the build does not own — a remote one, or a format
 * the generator is not asked to read. Callers fall back to the master, which
 * is what they shipped before this existed.
 */
export function blogPostCardFor(image: string) {
  const match = LOCAL_IMAGE.exec(image);

  if (!match) {
    return null;
  }

  return {
    path: `${SOCIAL_DIR}/${match[1]}.jpg`,
    width: BLOG_POST_CARD.width,
    height: BLOG_POST_CARD.height,
  };
}
