/**
 * Telemetry endpoints that must never be contacted from a build.
 *
 * `scripts/prerender.mjs` drives a real Chromium against a local server and
 * serializes the post-JS DOM, so any analytics code the app runs on load also
 * runs inside CI. `initAnalytics()` skips inject while `window.__PRERENDER__`
 * is set so the beacon is not baked into static HTML (a deferred script in the
 * snapshot would race fonts on real visits and undo the load-gated inject).
 * This network blocklist is the second, independent guard: if a future change
 * reintroduces a beacon fetch during prerender, Chromium still cannot contact
 * Cloudflare and invent synthetic pageviews under the site token.
 *
 * Hits from `127.0.0.1` would not match the traffic read-out filter on
 * `requestHost: pratik.pa.tel` either way; this keeps CI out of the dashboard
 * a human reads.
 */

/** Hosts whose requests are aborted during prerender. */
export const TELEMETRY_HOSTS = [
  // Cloudflare Web Analytics beacon (src/lib/analytics.ts).
  "static.cloudflareinsights.com",
  "cloudflareinsights.com",
  // Bounded edge collector (src/lib/traffic-pixel.ts). That module already
  // guards on the production hostname; this is the second, independent guard,
  // so a regression there still cannot manufacture traffic from CI.
  "patel-links.bounded.page",
];

/** True when `url` targets a telemetry endpoint that a build must not contact. */
export function isTelemetryRequest(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }

  return TELEMETRY_HOSTS.includes(host);
}
