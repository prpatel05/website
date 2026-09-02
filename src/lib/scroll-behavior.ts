/**
 * The imperative half of the reduced-motion contract.
 *
 * The other two halves are declarative and were already covered: the
 * `@media (prefers-reduced-motion: reduce)` block in `index.css` and
 * `MotionConfig reducedMotion="user"` in `App.tsx`. Neither reaches a
 * `scrollIntoView`/`scrollTo` call — a hardcoded `behavior: "smooth"` animates
 * regardless of what the reader asked for, and Chromium does not soften it on
 * their behalf.
 *
 * Measured on a built `dist/` (chromium, 1280x800), sampling `window.scrollY`
 * every frame from document start. The terminal's `contact` command:
 *
 * | reader | distinct scroll positions | travel |
 * | --- | --- | --- |
 * | `prefers-reduced-motion: reduce` | 56 | 3112px |
 * | no preference | 56 — identical sample sequence | 3112px |
 *
 * The nav's own `#contact` link reaches the same place in 2 samples, so the
 * page already behaved for that reader on every other path to the same section.
 *
 * Read at call time rather than cached at module scope: the setting is an OS
 * toggle a reader can flip mid-session, and there is no re-render to invalidate
 * a cached value against.
 */
export const scrollBehavior = (): ScrollBehavior => {
  if (typeof window === "undefined") return "auto";
  // Optional-called: prerender runs this module in an environment that has a
  // `window` but need not have implemented `matchMedia`, and a reader who
  // cannot be asked is the one to move the least.
  const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  return query?.matches ? "auto" : "smooth";
};
