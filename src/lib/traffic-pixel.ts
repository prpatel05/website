/**
 * Bounded edge traffic pixel — cookieless, no consent banner required
 * (PRA-503: fallback instrument for pratik.pa.tel when no Cloudflare Web
 * Analytics site token exists).
 *
 * We fire one request per page load at:
 *
 *   https://<collector>/px/<page-path>/ref/<referrer-host>
 *
 * The collector is a Bounded-hosted app. Bounded edge-tracks every request to
 * it, so the request itself is the datapoint — nothing needs to parse or
 * respond. The read-out is `bounded analytics --app-id <id> --range 1h --json`,
 * where `topPages` carries the full encoded path.
 *
 * Why the path carries the referrer instead of the Referer header: the header
 * on this request is always this site's own origin, because that is the page
 * making the request. The original referrer is only visible to us here, in the
 * browser, via `document.referrer`.
 *
 * Every path segment is reduced to [a-z0-9-]. That is not cosmetic: a dot in
 * the FINAL segment of a collector path 404s (`/ref/t.co` → 404,
 * `/ref/t-co` → 200). A 404 is still edge-tracked, so a dotted host would look
 * fine in the browser and quietly land in the `errors` bucket instead of the
 * clean one. Hosts are therefore encoded dot-free: `t.co` → `t-co`.
 *
 * Counting caveat, which the read-out must respect: `visitors` and `sessions`
 * stay 0 here. Those require Bounded's same-origin RUM script, which cannot be
 * embedded on a GitHub Pages origin. Edge tracking also counts non-JS clients
 * and bots. So this instrument reports referrer-segmented EVENT COUNTS, and
 * Bounded documents these as sample-weighted estimates — never report them as
 * exact pageview counts.
 */

/** Bounded-hosted collector. Public URL, not a credential — safe to commit. */
const DEFAULT_COLLECTOR = "https://patel-links.bounded.page";

/** Only the live site reports. Keeps dev, CI and prerender out of the data. */
const PRODUCTION_HOST = "pratik.pa.tel";

/**
 * Bounded's analytics route-normalizer rewrites any path segment of 20 or more
 * characters to the literal `:id`, merging it with every other long segment at
 * that position. Measured on the collector: a 19-char segment is reported
 * verbatim; 20- and 21-char segments both come back as `:id`.
 *
 * That silently destroys both dimensions we care about. Fourteen of the twenty
 * blog slugs are 20+ characters, and `news.ycombinator.com` encodes to
 * `news-ycombinator-com`, which is exactly 20 — so Hacker News referrals would
 * vanish into `:id`. Capping every segment at 19 keeps them distinct, and the
 * cap collides on nothing: neither across the blog slugs nor across the
 * referrer hosts we expect.
 */
const MAX_SEGMENT = 19;

/**
 * Reduce one URL path segment to a collector-safe token: lowercase, dot-free,
 * `[a-z0-9-]` only, and short enough to survive route normalization. Returns ""
 * for a segment with no usable characters.
 */
function safeSegment(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SEGMENT)
    .replace(/-+$/g, "");
}

/** `/blog/agents-fail-quietly` → `blog/agents-fail-quietly`; `/` → `home`. */
export function encodePagePath(pathname: string): string {
  const encoded = pathname
    .split("/")
    .map(safeSegment)
    .filter(Boolean)
    .slice(0, 4)
    .join("/");

  return encoded || "home";
}

/**
 * `https://t.co/abc` → `t-co`; `https://www.linkedin.com/x` → `linkedin-com`.
 * Empty referrer → `direct`. Our own origin → `internal`, so in-site
 * navigation never inflates a referral bucket.
 */
export function encodeReferrerHost(referrer: string, selfHost: string): string {
  if (!referrer) return "direct";

  let host: string;
  try {
    host = new URL(referrer).hostname;
  } catch {
    return "unknown";
  }

  host = host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (host === selfHost.toLowerCase()) return "internal";

  return safeSegment(host) || "unknown";
}

/** Full collector URL for one pageview. Exported for tests. */
export function buildPixelUrl(
  collector: string,
  pathname: string,
  referrer: string,
  selfHost: string,
): string {
  const page = encodePagePath(pathname);
  const ref = encodeReferrerHost(referrer, selfHost);
  return `${collector.replace(/\/$/, "")}/px/${page}/ref/${ref}`;
}

let fired = false;

export function initTrafficPixel(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (fired) return;

  // Path A wins if it is ever provisioned: Cloudflare Web Analytics is the
  // preferred instrument, and running both would double-count. Setting the
  // CF_BEACON_TOKEN repo variable retires this pixel with no code change.
  if (import.meta.env.VITE_CF_BEACON_TOKEN) return;

  const collector =
    import.meta.env.VITE_BOUNDED_PIXEL_ORIGIN ?? DEFAULT_COLLECTOR;
  if (!collector) return;

  // The prerender step drives a real Chromium against a local server, and dev
  // runs on localhost. Neither is real traffic; reporting either would poison
  // the data on every build.
  if (window.location.hostname !== PRODUCTION_HOST) return;

  fired = true;

  const url = buildPixelUrl(
    collector,
    window.location.pathname,
    document.referrer,
    PRODUCTION_HOST,
  );

  // Opaque, response ignored: the request reaching the edge IS the datapoint.
  // `keepalive` lets it survive an immediate navigation away.
  void fetch(url, {
    mode: "no-cors",
    cache: "no-store",
    credentials: "omit",
    keepalive: true,
  }).catch(() => {
    // An instrument must never break the page it measures.
  });
}

/** Test-only: reset the once-per-load guard. */
export function __resetTrafficPixelForTests(): void {
  fired = false;
}
