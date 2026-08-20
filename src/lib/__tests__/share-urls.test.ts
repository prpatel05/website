import { describe, expect, it } from "vitest";
import {
  RSS_URL,
  linkedInShareUrl,
  postCanonicalUrl,
  xShareUrl,
} from "../share-urls";

const POST_URL = "https://pratik.pa.tel/blog/test-post/";

describe("postCanonicalUrl", () => {
  it("is the production post URL in its non-redirecting form", () => {
    expect(postCanonicalUrl("test-post")).toBe(POST_URL);
  });

  it("does not pick up the preview origin or a slashless path", () => {
    expect(postCanonicalUrl("test-post")).toMatch(/^https:\/\/pratik\.pa\.tel\//);
    expect(postCanonicalUrl("test-post").endsWith("/")).toBe(true);
  });
});

describe("xShareUrl", () => {
  it("points at X's tweet intent with the title and the canonical URL", () => {
    const href = xShareUrl(POST_URL, "Test Post Title");
    const parsed = new URL(href);

    expect(parsed.origin + parsed.pathname).toBe("https://x.com/intent/tweet");
    expect(parsed.searchParams.get("url")).toBe(POST_URL);
    expect(parsed.searchParams.get("text")).toBe("Test Post Title");
  });

  it("encodes a title that would otherwise break the query string", () => {
    const href = xShareUrl(POST_URL, "Agents & \"quotes\"");
    const parsed = new URL(href);

    expect(parsed.searchParams.get("text")).toBe("Agents & \"quotes\"");
    expect(href).toContain("intent/tweet");
  });
});

describe("linkedInShareUrl", () => {
  it("points at LinkedIn's share-offsite intent with only the URL", () => {
    const href = linkedInShareUrl(POST_URL);
    const parsed = new URL(href);

    expect(parsed.origin + parsed.pathname).toBe(
      "https://www.linkedin.com/sharing/share-offsite/"
    );
    expect(parsed.searchParams.get("url")).toBe(POST_URL);
    expect([...parsed.searchParams.keys()]).toEqual(["url"]);
  });
});

describe("RSS_URL", () => {
  it("is the production feed, which is a file and so stays slashless", () => {
    expect(RSS_URL).toBe("https://pratik.pa.tel/rss.xml");
  });
});
