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

  test("llms.txt indexes published posts with markdown aliases", async ({
    request,
  }) => {
    const response = await request.get("/llms.txt");
    expect(response.ok()).toBe(true);
    const body = await response.text();

    expect(body.startsWith("# Pratik Patel")).toBe(true);
    expect(body).toContain("## Posts");
    expect(body).toMatch(
      /\[Ship It Yourself[^\]]*\]\(https:\/\/pratik\.pa\.tel\/blog\/ship-it-yourself\.md\)/
    );
  });

  test("a post markdown alias serves the source with front matter", async ({
    request,
  }) => {
    const response = await request.get("/blog/ship-it-yourself.md");
    expect(response.ok()).toBe(true);
    const body = await response.text();

    expect(body.startsWith("---")).toBe(true);
    expect(body).toContain('title: "Ship It Yourself');
    expect(body).toContain(
      'canonical: "https://pratik.pa.tel/blog/ship-it-yourself/"'
    );
    // More than front matter: the post body made it into the export.
    expect(body.length).toBeGreaterThan(400);
    expect(body).toContain("Five years ago");
  });

  test("post HTML declares a text/markdown alternate", async ({ request }) => {
    const response = await request.get("/blog/ship-it-yourself/");
    expect(response.ok()).toBe(true);
    const html = await response.text();

    expect(html).toContain('rel="alternate"');
    expect(html).toContain('type="text/markdown"');
    expect(html).toContain(
      'href="https://pratik.pa.tel/blog/ship-it-yourself.md"'
    );
  });

});
