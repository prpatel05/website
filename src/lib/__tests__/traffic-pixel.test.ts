import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { posts } from "@/data/blog-posts";
import {
  buildPixelUrl,
  encodePagePath,
  encodeReferrerHost,
  initTrafficPixel,
  __resetTrafficPixelForTests,
} from "../traffic-pixel";

const COLLECTOR = "https://patel-links.bounded.page";
const SELF = "pratik.pa.tel";

describe("encodePagePath", () => {
  it("encodes a blog path", () => {
    expect(encodePagePath("/blog/agents-fail-quietly")).toBe(
      "blog/agents-fail-quietly",
    );
  });

  it("maps the root path to a named segment rather than an empty one", () => {
    expect(encodePagePath("/")).toBe("home");
    expect(encodePagePath("")).toBe("home");
  });

  it("strips dots so a trailing segment can never 404", () => {
    // Also collapses the prerendered `.html` twin onto the same bucket as the
    // clean route, which is what we want: they are one page.
    expect(encodePagePath("/agents-fail-quietly.html")).toBe(
      "agents-fail-quietly",
    );
    expect(encodePagePath("/agents-fail-quietly")).toBe("agents-fail-quietly");
  });

  it("leaves a 19-char slug intact (the longest the collector reports verbatim)", () => {
    expect(encodePagePath("/blog/agents-fail-quietly")).toBe(
      "blog/agents-fail-quietly",
    );
  });

  it("caps segments below the 20-char route-normalizer threshold", () => {
    // 20+ chars would be rewritten to ":id" by the collector, merging every
    // long blog slug into one indistinguishable bucket.
    const encoded = encodePagePath("/blog/agent-permissions-are-product-design");
    const slug = encoded.split("/")[1];
    expect(slug.length).toBeLessThan(20);
    expect(slug).toBe("agent-permissions-a");
  });

  it("never leaves a trailing dash after truncation", () => {
    expect(encodePagePath("/blog/i-have-not-touched-code-in-one-month")).toBe(
      "blog/i-have-not-touched",
    );
  });

  // Truncating to 19 chars is only safe while it stays injective over the real
  // corpus. Ten of the current slugs land on exactly 19 characters, so two
  // posts sharing a 19-char prefix would silently merge into one bucket and the
  // read-out would attribute one post's traffic to another. These two run over
  // `posts`, not over fixtures, so adding such a post fails the build instead
  // of corrupting the data.
  describe("over every real blog post", () => {
    const encoded = posts.map((p) => ({
      slug: p.slug,
      segment: encodePagePath(`/blog/${p.slug}`).split("/")[1],
    }));

    it("keeps every slug under the 20-char normalizer threshold", () => {
      const collapsed = encoded.filter((e) => e.segment.length >= 20);
      expect(collapsed).toEqual([]);
    });

    it("encodes every slug to a distinct segment", () => {
      const bySegment = new Map<string, string[]>();
      for (const { slug, segment } of encoded) {
        bySegment.set(segment, [...(bySegment.get(segment) ?? []), slug]);
      }
      const collisions = [...bySegment.values()].filter((s) => s.length > 1);
      expect(collisions).toEqual([]);
    });
  });
});

describe("encodeReferrerHost", () => {
  it("encodes t.co dot-free (trap 1: /ref/t.co 404s)", () => {
    expect(encodeReferrerHost("https://t.co/abc123", SELF)).toBe("t-co");
  });

  it("encodes lnkd.in dot-free", () => {
    expect(encodeReferrerHost("https://lnkd.in/xyz", SELF)).toBe("lnkd-in");
  });

  it("strips a www. prefix", () => {
    expect(encodeReferrerHost("https://www.linkedin.com/feed", SELF)).toBe(
      "linkedin-com",
    );
  });

  it("reports an empty referrer as direct", () => {
    expect(encodeReferrerHost("", SELF)).toBe("direct");
  });

  it("reports our own origin as internal, not as a referral", () => {
    expect(encodeReferrerHost("https://pratik.pa.tel/blog", SELF)).toBe(
      "internal",
    );
  });

  it("reports an unparseable referrer as unknown", () => {
    expect(encodeReferrerHost("not-a-url", SELF)).toBe("unknown");
  });
});

describe("buildPixelUrl", () => {
  it("builds the documented collector path", () => {
    expect(
      buildPixelUrl(COLLECTOR, "/blog/agents-fail-quietly", "https://t.co/x", SELF),
    ).toBe(`${COLLECTOR}/px/blog/agents-fail-quietly/ref/t-co`);
  });

  it("never emits a dot in the final segment", () => {
    const url = buildPixelUrl(COLLECTOR, "/x", "https://news.ycombinator.com", SELF);
    expect(url.split("/").pop()!).not.toContain(".");
  });

  it("keeps news.ycombinator.com under the 20-char normalizer threshold", () => {
    // "news-ycombinator-com" is exactly 20 chars and would collapse to ":id",
    // erasing Hacker News as a distinguishable referrer.
    const ref = buildPixelUrl(COLLECTOR, "/x", "https://news.ycombinator.com", SELF)
      .split("/")
      .pop()!;
    expect(ref.length).toBeLessThan(20);
    expect(ref).toBe("news-ycombinator-co");
  });
});

describe("initTrafficPixel", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    __resetTrafficPixelForTests();
    global.fetch = vi.fn(() => Promise.resolve(new Response(null)));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function stubLocation(hostname: string, pathname: string) {
    vi.stubGlobal("location", { hostname, pathname });
    Object.defineProperty(window, "location", {
      value: { hostname, pathname },
      writable: true,
      configurable: true,
    });
  }

  it("does not fire off the production host (dev, CI, prerender)", () => {
    stubLocation("localhost", "/blog/agents-fail-quietly");
    initTrafficPixel();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fires once on the production host with the encoded referrer", () => {
    stubLocation(SELF, "/blog/agents-fail-quietly");
    vi.spyOn(document, "referrer", "get").mockReturnValue("https://t.co/abc");

    initTrafficPixel();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${COLLECTOR}/px/blog/agents-fail-quietly/ref/t-co`);
    expect(opts).toMatchObject({ mode: "no-cors", keepalive: true });
  });

  it("stands down when the Cloudflare beacon is provisioned (never both)", () => {
    vi.stubEnv("VITE_CF_BEACON_TOKEN", "real-token");
    stubLocation(SELF, "/blog/agents-fail-quietly");
    initTrafficPixel();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not fire twice on repeat calls", () => {
    stubLocation(SELF, "/");
    initTrafficPixel();
    initTrafficPixel();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("never rejects when the collector is unreachable", async () => {
    stubLocation(SELF, "/");
    global.fetch = vi.fn(() => Promise.reject(new Error("offline")));
    expect(() => initTrafficPixel()).not.toThrow();
    await Promise.resolve();
  });
});
