import { describe, expect, it } from "vitest";
import {
  ARCHIVE_HREF,
  archiveTagHref,
  normalizeArchiveTag,
  postsWithTag,
  uniqueTags,
} from "../blog-tags";

const posts = [
  { slug: "a", tags: ["agents", "ai"] },
  { slug: "b", tags: ["ai", "evals"] },
  { slug: "c", tags: ["leadership"] },
  { slug: "d", tags: ["ai"] },
];

describe("uniqueTags", () => {
  it("derives a sorted, de-duplicated list from the posts", () => {
    expect(uniqueTags(posts)).toEqual(["agents", "ai", "evals", "leadership"]);
  });

  it("drops empty tags and does not invent any", () => {
    expect(uniqueTags([{ tags: ["ai", "", "ai"] }, { tags: [] }])).toEqual(["ai"]);
  });
});

describe("postsWithTag", () => {
  it("returns the full list when no tag is active", () => {
    expect(postsWithTag(posts, null).map((p) => p.slug)).toEqual(["a", "b", "c", "d"]);
    expect(postsWithTag(posts, "").map((p) => p.slug)).toEqual(["a", "b", "c", "d"]);
    expect(postsWithTag(posts, "   ").map((p) => p.slug)).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps only posts that carry the exact tag", () => {
    expect(postsWithTag(posts, "ai").map((p) => p.slug)).toEqual(["a", "b", "d"]);
    expect(postsWithTag(posts, "leadership").map((p) => p.slug)).toEqual(["c"]);
  });

  it("returns an empty list for an unknown tag", () => {
    expect(postsWithTag(posts, "not-a-tag")).toEqual([]);
  });

  it("does not match a different casing", () => {
    expect(postsWithTag(posts, "AI")).toEqual([]);
  });
});

describe("normalizeArchiveTag", () => {
  it("treats missing and blank values as no filter", () => {
    expect(normalizeArchiveTag(null)).toBeNull();
    expect(normalizeArchiveTag("")).toBeNull();
    expect(normalizeArchiveTag("  ")).toBeNull();
  });

  it("keeps a real tag, trimmed", () => {
    expect(normalizeArchiveTag("  agents ")).toBe("agents");
  });
});

describe("archiveTagHref", () => {
  it("is a query on the trailing-slash archive, not a new route", () => {
    expect(archiveTagHref("ai")).toBe("/blog/?tag=ai");
    expect(ARCHIVE_HREF).toBe("/blog/");
  });

  it("encodes characters that would break the query string", () => {
    expect(archiveTagHref("human-in-the-loop")).toBe("/blog/?tag=human-in-the-loop");
    expect(archiveTagHref("c++")).toBe("/blog/?tag=c%2B%2B");
    expect(new URL(archiveTagHref("a&b"), "https://pratik.pa.tel").searchParams.get("tag")).toBe(
      "a&b"
    );
  });
});
