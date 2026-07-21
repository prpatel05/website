import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  heroFor,
  HERO_DIR,
  HERO_MASTER_WIDTH,
  HERO_SIZES,
  HERO_WIDTHS,
} from "../hero";
import {
  assertMasterWidth,
  HERO_DIR as SCRIPT_DIR,
  HERO_MASTER_WIDTH as SCRIPT_MASTER_WIDTH,
  HERO_WIDTHS as SCRIPT_WIDTHS,
  heroTargets,
  heroVariants,
} from "../../../scripts/hero.mjs";
import { posts } from "@/data/blog-posts/registry";

describe("post hero", () => {
  it("names a variant per width, then the master", () => {
    expect(heroFor("/images/blog-10x-engineer.webp")).toEqual({
      src: "/images/hero/blog-10x-engineer-704w.webp",
      srcSet:
        "/images/hero/blog-10x-engineer-704w.webp 704w, " +
        "/images/hero/blog-10x-engineer-960w.webp 960w, " +
        "/images/blog-10x-engineer.webp 1200w",
    });
  });

  it("declares widths in ascending order, all below the master", () => {
    expect(HERO_WIDTHS).toEqual([...HERO_WIDTHS].sort((a, b) => a - b));
    expect(Math.max(...HERO_WIDTHS)).toBeLessThan(HERO_MASTER_WIDTH);
  });

  // A remote hero is not the build's to resize. The page falls back to `image`
  // with no srcSet at all rather than pointing at a file nothing emitted.
  it("declines a hero the build does not own", () => {
    expect(heroFor("https://example.com/hero.webp")).toBeNull();
    expect(heroFor("/images/hero.gif")).toBeNull();
  });

  // `container max-w-3xl` is 768px wide including the container's 2rem of
  // padding on each side. A column width claimed wider than that is the
  // over-fetch this module exists to remove, reintroduced.
  it("sizes the small candidate to the column, not the container", () => {
    expect(HERO_WIDTHS[0]).toBe(768 - 2 * 32);
  });

  it("describes the column and the viewport-bound box", () => {
    expect(HERO_SIZES).toBe("(min-width: 768px) 704px, calc(100vw - 4rem)");
  });

  // The post page renders in the app bundle and the generator runs in Node, so
  // the derivation exists twice. This is what stops the two from drifting: a
  // width changed on one side and not the other points the <img> at a file the
  // build never emitted.
  describe("stays in step with the generator", () => {
    it("agrees on widths and directory", () => {
      expect(HERO_WIDTHS).toEqual(SCRIPT_WIDTHS);
      expect(HERO_MASTER_WIDTH).toBe(SCRIPT_MASTER_WIDTH);
      expect(HERO_DIR).toBe(SCRIPT_DIR);
    });

    it("agrees on src and srcSet for every post", () => {
      for (const post of posts) {
        expect(heroVariants(post.image)).toEqual(heroFor(post.image));
      }
    });

    // The <img> can request any entry in the srcSet, so every entry has to be
    // a file that exists — either one the generator emits or the master.
    it("emits every derived srcSet entry", () => {
      for (const post of posts) {
        const hero = heroFor(post.image);
        if (!hero) continue;

        const emitted = heroTargets(post.image).map(
          (target: { publicPath: string }) => target.publicPath
        );

        expect(emitted).toContain(hero.src);

        for (const entry of hero.srcSet.split(", ")) {
          const path = entry.split(" ")[0];

          // Every candidate is either a file the generator emits or the master
          // itself, which has to be on disk for the generator to read.
          if (path === post.image) {
            expect(
              existsSync(join(process.cwd(), "public", path.slice(1)))
            ).toBe(true);
          } else {
            expect(emitted).toContain(path);
          }
        }
      }
    });
  });

  // The srcSet hands the browser `${master} 1200w` on the strength of every
  // hero being 1200x670. The generator is what enforces that; this is what
  // proves it still refuses a narrower one.
  describe("refuses a master narrower than its descriptor", () => {
    it("throws below the master width", () => {
      expect(() =>
        assertMasterWidth({
          image: "/images/blog-narrow.webp",
          width: 800,
          describe: "narrow-post",
        })
      ).toThrow(/800w/);
    });

    it("accepts the master width and above", () => {
      for (const width of [HERO_MASTER_WIDTH, HERO_MASTER_WIDTH + 400]) {
        expect(() =>
          assertMasterWidth({
            image: "/images/blog-wide.webp",
            width,
            describe: "wide-post",
          })
        ).not.toThrow();
      }
    });
  });
});
