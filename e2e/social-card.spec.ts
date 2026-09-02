import { test, expect } from "./fixtures";
import { imageSize } from "../src/lib/image-size";
import { discoverPostSlugs } from "../scripts/blog-posts.mjs";

/**
 * The image a link preview actually renders.
 *
 * Every post used to hand scrapers its hero master: WebP, 1200x670. That is
 * the right file for the <img> and the wrong one for `og:image` — LinkedIn's
 * published image spec lists JPG, PNG and GIF and does not include WebP, and
 * LinkedIn is where these posts are distributed. The homepage card was already
 * a PNG at the standard 1200x630, so the posts were the ones out of step.
 *
 * Nothing in the unit suite can see this. The card is derived during the
 * build, and `bun run test` runs before `bun run build` in CI, so the only
 * place the real bytes exist is here — against the built site, over HTTP, the
 * same way a scraper would fetch them.
 *
 * Slugs come from the same discovery the build uses rather than a hardcoded
 * list, so a post added by the unattended auto-merge routine is covered the
 * day it lands.
 */

const slugs = discoverPostSlugs().sort();

/** What the tags claim, read out of the prerendered HTML. */
const cardMetaOf = (html: string) => {
  const content = (prop: string) =>
    (html.match(
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`,
        "i"
      )
    ) ?? [])[1];

  return {
    ogImage: content("og:image"),
    twitterImage: content("twitter:image"),
    width: content("og:image:width"),
    height: content("og:image:height"),
  };
};

test.describe("post share cards are a format scrapers accept", () => {
  for (const slug of slugs) {
    test(`${slug} previews as a 1200x630 JPEG`, async ({ page, request }) => {
      const response = await page.goto(`/blog/${slug}/`);
      const meta = cardMetaOf((await response!.text()) ?? "");

      // The tag has to name a JPEG, not the WebP master the page paints.
      expect(meta.ogImage, `${slug} declares no og:image`).toBeTruthy();
      expect(meta.ogImage).toMatch(/^https:\/\/pratik\.pa\.tel\/images\/social\/.+\.jpg$/);
      // A card X ignores is as bad as one LinkedIn ignores.
      expect(meta.twitterImage).toBe(meta.ogImage);

      // ...and the file behind it has to exist and be that JPEG. A tag
      // pointing at a path the generator never emitted is a 404 in the
      // scraper, which renders as no card at all.
      const path = new URL(meta.ogImage!).pathname;
      const image = await request.get(path);

      expect(image.status(), `${path} is not served`).toBe(200);
      expect(image.headers()["content-type"]).toContain("image/jpeg");

      const body = await image.body();
      // Magic bytes rather than the extension: a WebP renamed .jpg would pass
      // every assertion above and still be the thing this test exists to stop.
      expect(
        [body[0], body[1]],
        `${path} is not JPEG-encoded`
      ).toEqual([0xff, 0xd8]);

      // 1.91:1 is what Facebook, LinkedIn, X, Slack and Discord render
      // uncropped. The declaration has to match the bytes — a scraper lays the
      // card out from the declared size, then reflows or drops it when the
      // real image disagrees.
      const size = imageSize(body);
      expect(size).toEqual({ width: 1200, height: 630 });
      expect(meta.width).toBe(String(size.width));
      expect(meta.height).toBe(String(size.height));
    });
  }
});
