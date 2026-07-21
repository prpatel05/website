/**
 * Telemetry endpoints that must never be contacted from a build.
 *
 * `scripts/prerender.mjs` drives a real Chromium against a local server and
 * serializes the post-JS DOM, so any analytics code the app runs on load also
 * runs — and fires — inside CI. The Cloudflare beacon is injected by
 * `initAnalytics()` as a real <script src> tag, which Chromium then fetches and
 * executes, reporting a pageview whose `location.host` is `127.0.0.1`. That is
 * one synthetic hit per prerendered route per deploy, recorded under the site
 * token and visible in the Cloudflare Web Analytics dashboard.
 *
 * It does not corrupt the traffic read-out, which filters the RUM dataset on
 * `requestHost: pratik.pa.tel`; a hit from `127.0.0.1` cannot match. Merging
 * this guard is therefore not an ordering prerequisite for setting
 * `CF_BEACON_TOKEN` — it keeps CI out of the dashboard a human reads.
 *
 * We block at the network layer rather than guarding `initAnalytics()` on the
 * production hostname, because the injected tag must still be serialized into
 * the static HTML: that is what makes the beacon visible to
 * `curl -s https://pratik.pa.tel/... | grep data-cf-beacon`, and what lets it
 * load for real visitors without waiting on the JS bundle. Blocking the request
 * keeps the tag and drops the hit.
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
