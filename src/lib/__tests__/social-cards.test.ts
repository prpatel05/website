import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { posts } from "../../data/blog-posts/registry";
import { imageSize } from "../image-size";

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

const publicImage = (path: string) =>
  imageSize(readFileSync(join(__dirname, "../../../public", path)));

describe("social share images", () => {
  it("homepage card is at least 1200x630", () => {
    const { width, height } = publicImage("/images/social-card.png");
    expect(width).toBeGreaterThanOrEqual(MIN_WIDTH);
    expect(height).toBeGreaterThanOrEqual(MIN_HEIGHT);
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
});
