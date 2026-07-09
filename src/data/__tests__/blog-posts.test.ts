import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { posts, getPostBySlug } from "../blog-posts";

describe("blog-posts data", () => {
  it("exports a non-empty posts array", () => {
    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
  });

  it("each post has required fields", () => {
    for (const post of posts) {
      expect(post.slug).toBeTruthy();
      expect(post.title).toBeTruthy();
      expect(post.subtitle).toBeTruthy();
      expect(post.date).toBeTruthy();
      expect(post.dateISO).toBeTruthy();
      expect(post.readTime).toBeTruthy();
      expect(Array.isArray(post.tags)).toBe(true);
      expect(post.tags.length).toBeGreaterThan(0);
      expect(post.image).toBeTruthy();
      expect(post.content).toBeTruthy();
    }
  });

  it("each post has a unique slug", () => {
    const slugs = posts.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("each post has a unique image path", () => {
    const images = posts.map((p) => p.image);
    expect(new Set(images).size).toBe(images.length);
  });

  // Guards the discovery contract: dropping a .ts file into the directory must
  // publish it, with no shared index to edit. Filenames need not match slugs.
  it("discovers every post file in the directory", () => {
    const postsDir = join(process.cwd(), "src", "data", "blog-posts");
    const discovered = readdirSync(postsDir)
      .filter(
        (name) =>
          name.endsWith(".ts") && name !== "index.ts" && name !== "types.ts"
      )
      .map((name) => {
        const source = readFileSync(join(postsDir, name), "utf-8");
        const slug = /slug:\s*"([^"]+)"/.exec(source)?.[1];
        expect(slug, `${name} has no slug`).toBeTruthy();
        return slug as string;
      })
      .sort();

    expect(posts.map((p) => p.slug).sort()).toEqual(discovered);
  });

  it("orders posts newest first, breaking ties by slug", () => {
    const expected = [...posts].sort(
      (a, b) =>
        b.dateISO.localeCompare(a.dateISO) || a.slug.localeCompare(b.slug)
    );

    expect(posts.map((p) => p.slug)).toEqual(expected.map((p) => p.slug));
  });

  it("each local blog image asset has unique file contents", () => {
    const seenHashes = new Map<string, string>();

    for (const post of posts) {
      if (!post.image.startsWith("/")) {
        continue;
      }

      const assetPath = join(process.cwd(), "public", post.image.slice(1));
      expect(
        existsSync(assetPath),
        `${post.slug} points to a missing image asset: ${post.image}`
      ).toBe(true);

      const hash = createHash("sha256")
        .update(readFileSync(assetPath))
        .digest("hex");
      const duplicateSlug = seenHashes.get(hash);

      expect(
        duplicateSlug,
        `${post.slug} reuses the same image file contents as ${duplicateSlug}`
      ).toBeUndefined();

      seenHashes.set(hash, post.slug);
    }
  });

  it("dateISO is a valid ISO date string", () => {
    for (const post of posts) {
      const parsed = new Date(post.dateISO);
      expect(parsed.toString()).not.toBe("Invalid Date");
    }
  });
});

describe("getPostBySlug", () => {
  it("returns the matching post for a known slug", () => {
    const first = posts[0];
    const result = getPostBySlug(first.slug);
    expect(result).toBeDefined();
    expect(result!.slug).toBe(first.slug);
    expect(result!.title).toBe(first.title);
  });

  it("returns undefined for an unknown slug", () => {
    expect(getPostBySlug("this-slug-does-not-exist")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(getPostBySlug("")).toBeUndefined();
  });

  it("finds each post by its slug", () => {
    for (const post of posts) {
      const found = getPostBySlug(post.slug);
      expect(found).toBeDefined();
      expect(found!.title).toBe(post.title);
    }
  });
});
