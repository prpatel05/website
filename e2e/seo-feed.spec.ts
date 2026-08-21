import { test, expect } from "./fixtures";

/**
 * Crawler/feed metadata. Nothing here is visible on the page — these are the
 * fields a scraper or a reader app actually consumes. The unit suite covers
 * the constructors; this is the "they survived prerender and landed in dist/"
 * half.
 */

const jsonLdOf = (html: string) =>
  [...html.matchAll(
    /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
  )].flatMap((match) => {
    const value = JSON.parse(match[1]);
    return Array.isArray(value) ? value : [value];
  });

test.describe("crawler metadata", () => {
  test("rss items carry category, creator, and an encoded body", async ({
    request,
  }) => {
    const response = await request.get("/rss.xml");
    expect(response.ok()).toBe(true);
    const xml = await response.text();

    expect(xml).toContain("<dc:creator>Pratik Patel</dc:creator>");
    expect(xml).toMatch(/<category>[^<]+<\/category>/);
    expect(xml).toContain("<content:encoded>");
    expect(xml).toContain("<lastBuildDate>");
    // More than a dek: a real post body made it into the item.
    expect(xml).toMatch(
      /<content:encoded><!\[CDATA\[[\s\S]{80,}\]\]><\/content:encoded>/
    );
  });

  test("homepage Person.sameAs includes Substack", async ({ request }) => {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);
    const person = jsonLdOf(await response.text()).find(
      (node) => node["@type"] === "Person"
    );

    expect(person?.sameAs).toContain("https://prpatel05.substack.com");
  });

  test("a post BlogPosting names the crawler fields", async ({ request }) => {
    const response = await request.get("/blog/ship-it-yourself/");
    expect(response.ok()).toBe(true);
    const posting = jsonLdOf(await response.text()).find(
      (node) => node["@type"] === "BlogPosting"
    );

    expect(posting?.dateModified).toBe(posting?.datePublished);
    expect(posting?.mainEntityOfPage).toEqual({
      "@type": "WebPage",
      "@id": "https://pratik.pa.tel/blog/ship-it-yourself/",
    });
    expect(posting?.inLanguage).toBe("en");
    expect(posting?.wordCount).toBeGreaterThan(100);
    expect(posting?.image).toEqual(
      expect.objectContaining({
        "@type": "ImageObject",
        width: 1200,
        height: 630,
      })
    );
  });
});
