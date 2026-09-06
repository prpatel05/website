/**
 * Client-only prefs for the homepage UX layer. Keys are namespaced so a future
 * preference does not collide with anything else on pratik.pa.tel.
 *
 * Reads/writes are try/catch'd: Safari private mode and locked-down embeds can
 * throw on `localStorage`, and a preference must never take the page down.
 */

export const CRT_NOISE_KEY = "pratik.crt-noise";
export const HERO_BOOT_SEEN_KEY = "pratik.hero-boot-seen";

export function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeFlag(key: string, on: boolean): void {
  try {
    if (on) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    // Preference is best-effort.
  }
}
