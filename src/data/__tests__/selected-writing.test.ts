import { describe, expect, it } from "vitest";
import { getPostBySlug } from "@/data/blog-posts/registry";
import { SELECTED_WRITING_SLUGS } from "../selected-writing";
import { isSeriesMember } from "@/lib/blog-series";

describe("SELECTED_WRITING_SLUGS", () => {
  it("lists exactly three curated posts", () => {
    expect(SELECTED_WRITING_SLUGS).toHaveLength(3);
  });

  it("resolves every slug against the live registry", () => {
    for (const slug of SELECTED_WRITING_SLUGS) {
      expect(getPostBySlug(slug), slug).toBeDefined();
    }
  });

  it("mixes agent-reliability members with at least one outsider", () => {
    const posts = SELECTED_WRITING_SLUGS.map((slug) => getPostBySlug(slug)!);
    const inSeries = posts.filter(isSeriesMember);
    const outside = posts.filter((p) => !isSeriesMember(p));
    expect(inSeries.length).toBeGreaterThanOrEqual(2);
    expect(outside.length).toBeGreaterThanOrEqual(1);
  });
});
