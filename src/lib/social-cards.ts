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

/** Every blog card is generated at this size; a post that isn't fails the test. */
export const BLOG_POST_CARD = {
  width: 1200,
  height: 670,
} as const;
