import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { test, expect } from "./fixtures";

/**
 * Every internal link the site ships answers 200 — no redirect hop, no 404.
 *
 * `terminal-commands.ts` once emitted an unslashed `/blog`. GitHub Pages 301s
 * that to `/blog/`, so the one routing command on the site put the redirecting
 * form in the address bar. That was fixed at the single call site that broke
 * (see `terminal.spec.ts`), which leaves every other link on the site — 26
 * distinct internal hrefs across 26 prerendered pages — guarded by nothing.
 *
 * This cannot be an HTTP check against the e2e server. `vite preview` answers
 * 200 for `/blog`, `/blog/` *and* `/blog/agents-fail-quietly` alike, because its
 * SPA fallback serves `index.html` for anything it cannot match to a file. So a
 * `request.get()` sweep passes on precisely the markup this is meant to catch.
 * Measured against production on 2026-08-09:
 *
 *   /blog                        301 -> /blog/
 *   /blog/                       200
 *   /blog/agents-fail-quietly    301 -> /blog/agents-fail-quietly/
 *   /blog/agents-fail-quietly/   200
 *   /nope                        404
 *
 * Those are Pages' rules, not the preview server's, so the resolution below is
 * modelled against `dist/` — the exact tree the deploy uploads — rather than
 * asked of a server that answers by different ones.
 *
 * Scope is anchors in prerendered HTML. Links a command constructs at runtime
 * never appear here; `terminal.spec.ts` owns those.
 */

const DIST = fileURLToPath(new URL("../dist", import.meta.url));

/** The production origin, so absolute self-links are checked like relative ones. */
const SITE_ORIGIN = "https://pratik.pa.tel";

type Resolution = "ok" | "redirect" | "missing";

/**
 * What GitHub Pages would answer for a site-absolute path, decided by what is
 * on disk.
 *
 * A file at the exact path is served as-is. A directory holding `index.html` is
 * served only under its trailing-slash form; asked for without the slash, Pages
 * 301s to add it. Anything else is a 404.
 */
function resolve(pathname: string): Resolution {
  const rel = pathname.replace(/^\/+/, "");
  const asFile = path.join(DIST, rel);

  if (rel !== "" && existsSync(asFile) && statSync(asFile).isFile()) return "ok";

  const dirIndex = path.join(DIST, rel, "index.html");
  if (existsSync(dirIndex)) return pathname.endsWith("/") ? "ok" : "redirect";

  return "missing";
}

/** Every `href` an anchor in the built HTML carries, with the page it came from. */
function collectInternalLinks() {
  const pages = readdirSync(DIST, { recursive: true, encoding: "utf8" }).filter((p) =>
    p.endsWith(".html")
  );
  const links = new Map<string, Set<string>>();

  for (const page of pages) {
    const html = readFileSync(path.join(DIST, page), "utf8");
    for (const [, href] of html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
      let pathname: string;
      if (href.startsWith(SITE_ORIGIN)) pathname = href.slice(SITE_ORIGIN.length) || "/";
      else if (href.startsWith("/")) pathname = href;
      else continue; // external, mailto:, or an in-page #fragment

      // A query or fragment does not change which file answers.
      pathname = pathname.split("#")[0].split("?")[0];
      if (!pathname) continue;

      if (!links.has(pathname)) links.set(pathname, new Set());
      links.get(pathname)!.add("/" + page);
    }
  }
  return links;
}

test.describe("internal links resolve without a redirect", () => {
  test("every anchor in the built site points at a path Pages answers 200", () => {
    const links = collectInternalLinks();

    // Control: a pass must mean "all clean", never "found nothing to check".
    // The homepage alone carries the nav, so anything less means the collector
    // stopped matching the markup and the sweep below is vacuous.
    expect(links.size, "no internal links were collected — the sweep is vacuous").toBeGreaterThan(10);

    const broken = [...links.entries()]
      .map(([pathname, sources]) => ({ pathname, sources, state: resolve(pathname) }))
      .filter(({ state }) => state !== "ok")
      .map(
        ({ pathname, sources, state }) =>
          `${pathname} — ${
            state === "redirect" ? "301s (needs a trailing slash)" : "404s (nothing on disk)"
          }, linked from ${[...sources].slice(0, 3).join(", ")}`
      );

    expect(broken, `${broken.length} internal link(s) do not answer 200:\n  ${broken.join("\n  ")}`).toEqual([]);
  });

  test("the resolver holds Pages' rules, not the preview server's", () => {
    // Without this, a resolver that returned "ok" for everything would make the
    // sweep above pass on any build at all.
    expect(resolve("/blog/")).toBe("ok");
    expect(resolve("/blog")).toBe("redirect");
    expect(resolve("/this-route-does-not-exist/")).toBe("missing");
  });
});
