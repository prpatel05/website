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
 *
 * Injection waits for `window` `load` so the beacon does not share the home
 * mobile LCP bandwidth race with the preloaded display face (lab 2026-09-14).
 * Prerender must not run that inject: `document.readyState` is already
 * `complete` in the snapshot browser, so the "after load" path would bake a
 * deferred `<script src=beacon>` into every route's HTML and put the beacon
 * back on the critical path for real visitors — undoing the deferral. Skip
 * while `window.__PRERENDER__` is set; the hydrating client injects after load.
 */
function injectBeacon(token: string): void {
  // Avoid double-injecting (e.g. across hot reloads or repeat calls).
  if (document.querySelector("script[data-cf-beacon]")) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.setAttribute("data-cf-beacon", JSON.stringify({ token }));
  document.body.appendChild(script);
}

export function initAnalytics(): void {
  const token = import.meta.env.VITE_CF_BEACON_TOKEN;
  if (!token) return;

  // See file header: baking the tag into prerendered HTML races fonts on visit.
  if (typeof window !== "undefined" && window.__PRERENDER__) return;

  const start = () => injectBeacon(token);
  if (document.readyState === "complete") {
    start();
  } else {
    window.addEventListener("load", start, { once: true });
  }
}
