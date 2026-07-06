/**
 * Cloudflare Web Analytics beacon — privacy-friendly, cookieless, no consent
 * banner required (PRA-465: ground-truth traffic analytics for pratik.pa.tel).
 *
 * The site token is public (it ships in the page source), but it is injected at
 * build time via the `VITE_CF_BEACON_TOKEN` env var so it can be provisioned /
 * rotated without a code change. When the var is unset — local dev, or before
 * the token has been created — this is a no-op and no beacon request fires.
 *
 * Cloudflare's beacon auto-tracks SPA route changes once loaded, so a single
 * injection covers every route including /blog/*.
 */
export function initAnalytics(): void {
  const token = import.meta.env.VITE_CF_BEACON_TOKEN;
  if (!token) return;

  // Avoid double-injecting (e.g. across hot reloads or repeat calls).
  if (document.querySelector('script[data-cf-beacon]')) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.setAttribute("data-cf-beacon", JSON.stringify({ token }));
  document.body.appendChild(script);
}
