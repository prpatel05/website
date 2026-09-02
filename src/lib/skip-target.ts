/**
 * The skip link's target, shared so the `href` in App.tsx and the `<main>` in each
 * page cannot drift apart — a skip link pointing at an id that no longer exists
 * fails silently, which is how the previous version went unnoticed.
 *
 * `tabIndex: -1` is not optional. A fragment link moves the *sequential focus
 * navigation start point* in Chrome and Firefox, but Safari and older WebKit only
 * move focus if the target is focusable. Without it the link scrolls and the next
 * Tab still lands on the navbar, which is the failure it exists to prevent.
 */
export const MAIN_CONTENT_ID = "main-content";

/**
 * Spread onto each page's `<main>`. Deliberately carries no `className`: pages
 * need their own layout classes there, and a `className` in here would either be
 * silently overwritten by the spread order or force every caller to remember to
 * merge it.
 *
 * The focus ring is handled globally instead — `main:focus` is styled off in
 * index.css, so the outline cannot come back by forgetting a utility class here.
 */
export const mainContentProps = {
  id: MAIN_CONTENT_ID,
  tabIndex: -1,
} as const;
