import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { posts } from "../../data/blog-posts/registry";
import { imageSize } from "../image-size";
import { SITE_CARD, BLOG_POST_CARD } from "../social-cards";

/**
 * LinkedIn and Facebook only render the large hero card at or above
 * 1200x630; below that they fall back to a small square thumbnail, and X
 * center-crops anything squarer than ~1.91:1. Every page on this site sets
 * `twitter:card=summary_large_image`, so every share image has to clear the
 * bar or the card silently degrades — which is exactly what happened when the
 * homepage shipped a 556x556 headshot as its og:image.
 */
const MIN_WIDTH = 1200;
const MIN_HEIGHT = 630;

const ORIGIN = "https://pratik.pa.tel";

const publicImage = (path: string) =>
  imageSize(readFileSync(join(__dirname, "../../../public", path)));

/** SITE_CARD.url is absolute; the file it names lives under public/. */
const sitePath = SITE_CARD.url.slice(ORIGIN.length);

describe("social share images", () => {
  it("site card is at least 1200x630", () => {
    const { width, height } = publicImage(sitePath);
    expect(width).toBeGreaterThanOrEqual(MIN_WIDTH);
    expect(height).toBeGreaterThanOrEqual(MIN_HEIGHT);
  });

  // A declared og:image:width that disagrees with the file is worse than
  // declaring nothing: the scraper lays the card out from the lie, then
  // reflows or drops it once the real bytes arrive.
  it("site card matches its declared og:image dimensions", () => {
    expect(publicImage(sitePath)).toEqual({
      width: SITE_CARD.width,
      height: SITE_CARD.height,
    });
  });

  // Posts land via the unattended auto-merge routine, so an undersized image
  // would otherwise ship to production with nobody looking at the card.
  it.each(posts.map((p) => [p.slug, p.image] as const))(
    "post %s has a large-card image",
    (_slug, image) => {
      const { width, height } = publicImage(image);
      expect(width).toBeGreaterThanOrEqual(MIN_WIDTH);
      expect(height).toBeGreaterThanOrEqual(MIN_HEIGHT);
    },
  );

  // BlogPost.tsx declares one static width/height for every post, so a post
  // whose image is sized differently would ship a wrong declaration. Same
  // unattended-merge exposure as above.
  it.each(posts.map((p) => [p.slug, p.image] as const))(
    "post %s matches the declared blog-card dimensions",
    (_slug, image) => {
      expect(publicImage(image)).toEqual({
        width: BLOG_POST_CARD.width,
        height: BLOG_POST_CARD.height,
      });
    },
  );
});
