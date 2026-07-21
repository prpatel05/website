import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { posts } from "@/data/blog-posts/registry";
import {
  THUMBNAIL_DIR,
  THUMBNAIL_WIDTHS,
  thumbnailFor,
} from "../blog-thumbnails";
import {
  THUMBNAIL_DIR as SCRIPT_DIR,
  THUMBNAIL_WIDTHS as SCRIPT_WIDTHS,
  thumbnailFor as scriptThumbnailFor,
  thumbnailTargets,
} from "../../../scripts/thumbnails.mjs";

describe("blog thumbnails", () => {
  // The point of the build step is that a post cannot land without a
  // thumbnail. New posts arrive through an unattended auto-merge routine, so
  // the guard has to be a test rather than a habit: if a future post uses a
  // hero shape the generator does not recognise — a remote URL, an unhandled
  // extension — the card silently falls back to the full-size hero and this is
  // where that shows up.
  it("resolves every registry post to a thumbnail", () => {
    const unresolved = posts
      .filter((post) => thumbnailFor(post.image) === null)
      .map((post) => `${post.slug}: ${post.image}`);

    expect(unresolved).toEqual([]);
  });

  it("names a thumbnail per width, smallest as the default src", () => {
    const thumb = thumbnailFor("/images/blog-example.webp");

    expect(thumb).toEqual({
      src: "/images/thumbs/blog-example-320w.webp",
      srcSet:
        "/images/thumbs/blog-example-320w.webp 320w, " +
        "/images/thumbs/blog-example-640w.webp 640w",
    });
  });

  it("declares widths in ascending order", () => {
    expect(THUMBNAIL_WIDTHS).toEqual([...THUMBNAIL_WIDTHS].sort((a, b) => a - b));
  });

  // Anything the generator cannot read has to fall back to the original hero
  // rather than point at a file the build will never write.
  it.each([
    "https://cdn.example.com/hero.png",
    "/images/hero.gif",
    "/assets/hero.webp",
  ])("returns null for %s", (image) => {
    expect(thumbnailFor(image)).toBeNull();
  });

  // The card renders in the app bundle and the generator runs in Node, so the
  // derivation exists twice. This is what stops the two from drifting: a width
  // added on one side and not the other points the card at a file the build
  // never emitted.
  describe("stays in step with the generator", () => {
    it("agrees on widths and directory", () => {
      expect(THUMBNAIL_WIDTHS).toEqual(SCRIPT_WIDTHS);
      expect(THUMBNAIL_DIR).toBe(SCRIPT_DIR);
    });

    it.each(posts.map((p) => [p.slug, p.image] as const))(
      "agrees on the thumbnail for %s",
      (_slug, image) => {
        expect(thumbnailFor(image)).toEqual(scriptThumbnailFor(image));
      }
    );

    // The card asks for every entry in the srcSet, so the generator has to
    // emit a file for every one of them.
    it.each(posts.map((p) => [p.slug, p.image] as const))(
      "emits every srcSet entry for %s",
      (_slug, image) => {
        const thumb = thumbnailFor(image);
        const emitted = thumbnailTargets(image).map(
          (target: { publicPath: string }) => target.publicPath
        );

        for (const entry of thumb.srcSet.split(", ")) {
          expect(emitted).toContain(entry.split(" ")[0]);
        }
        expect(emitted).toContain(thumb.src);
      }
    );
  });

  // The generator throws on a missing hero, which would fail the build rather
  // than ship a broken card. Catching it here names the post instead.
  it("has a hero on disk for every post", () => {
    const missing = posts
      .filter(
        (post) => !existsSync(join(process.cwd(), "public", post.image.slice(1)))
      )
      .map((post) => `${post.slug}: ${post.image}`);

    expect(missing).toEqual([]);
  });
});
