import { readFileSync } from "fs";

/**
 * index.html is the Vite shell; react-helmet-async overwrites these on hydrate,
 * and prerender rewrites route HTML. The shell still ships in the first response
 * for any path that falls back to it, and crawlers that only skim the template
 * still see these defaults. Keep them aligned with Index.tsx / #215 (no years
 * count; OpenApps | Bounded | poof.new voice).
 */
const html = readFileSync("index.html", "utf8");

const HOME_DESCRIPTION =
  "Technology executive and 3x company builder focused on scaling engineering orgs across AI, Cloud, and Web3. Currently Chief Architect at OpenApps | Bounded | poof.new.";

describe("index.html default meta", () => {
  it("does not advertise a years count in description / OG / Twitter", () => {
    expect(html).not.toMatch(/11\+\s*years/i);
    expect(html).not.toMatch(/\d+\+?\s*years/i);
  });

  it("uses the same home description as Index.tsx for description / OG / Twitter", () => {
    for (const attr of [
      'name="description"',
      'property="og:description"',
      'name="twitter:description"',
    ]) {
      const re = new RegExp(`<meta[^>]*${attr}[^>]*content="([^"]*)"`, "i");
      const m = html.match(re);
      expect(m?.[1], attr).toBe(HOME_DESCRIPTION);
    }
  });
});
