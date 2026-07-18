import { describe, expect, it } from "vitest";
import { canonicalUrl } from "../canonical-url";

describe("canonicalUrl", () => {
  it("adds the trailing slash GitHub Pages redirects to", () => {
    expect(canonicalUrl("https://pratik.pa.tel/blog")).toBe(
      "https://pratik.pa.tel/blog/"
    );
    expect(canonicalUrl("https://pratik.pa.tel/blog/taste-is-your-moat")).toBe(
      "https://pratik.pa.tel/blog/taste-is-your-moat/"
    );
  });

  it("leaves an already-canonical URL untouched", () => {
    expect(canonicalUrl("https://pratik.pa.tel/")).toBe(
      "https://pratik.pa.tel/"
    );
    expect(canonicalUrl("https://pratik.pa.tel/blog/")).toBe(
      "https://pratik.pa.tel/blog/"
    );
  });

  it("does not slash a real file, which is served without a redirect", () => {
    expect(canonicalUrl("https://pratik.pa.tel/sitemap.xml")).toBe(
      "https://pratik.pa.tel/sitemap.xml"
    );
  });

  it("keeps the slash ahead of any query or hash", () => {
    expect(canonicalUrl("https://pratik.pa.tel/blog?page=2")).toBe(
      "https://pratik.pa.tel/blog/?page=2"
    );
    expect(canonicalUrl("https://pratik.pa.tel/blog#recent")).toBe(
      "https://pratik.pa.tel/blog/#recent"
    );
  });
});
