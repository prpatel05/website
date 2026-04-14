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
