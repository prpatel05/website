/**
 * A full page load, spent at most once per mark per tab.
 *
 * Two different failures on this site have the same cause and the same cure.
 * Pages replaces `dist/` wholesale on deploy, so a tab opened beforehand is
 * holding a bundle whose content-hashed chunk URLs are gone; the next dynamic
 * import it makes rejects. That is true of a post's body chunk (see
 * `post-body-recovery`) and of the post route's own chunk (see `lazy-route`).
 *
 * The cure in both cases is a full load of the URL the reader is already on,
 * because that URL is prerendered: its HTML carries the page, and its `<script>`
 * tags name hashes from the deploy that is actually live. It is not a retry in
 * the hopeful sense — nothing about it can fail the way the stale chunk did.
 *
 * What it does need is a stop. A reload that lands on a page failing the same
 * way would ask for another one, so each mark buys exactly one, recorded in
 * `sessionStorage` because that is the store scoped to the tab and surviving
 * the very load being recorded.
 */

type MarkState = "fresh" | "spent" | "unrecordable";

/**
 * Claims the mark for this tab.
 *
 * Storage is the part that fails: a locked-down browser throws on the property
 * access, and Safari's private mode has historically accepted `setItem` and
 * thrown on it instead. Both are caught, and the write is read back rather than
 * assumed — what the caller needs to know is not that `setItem` returned but
 * that the next document will see this.
 */
const takeMark = (mark: string): MarkState => {
  try {
    const store = window.sessionStorage;
    if (store.getItem(mark)) return "spent";
    store.setItem(mark, "1");
    return store.getItem(mark) ? "fresh" : "unrecordable";
  } catch {
    return "unrecordable";
  }
};

/**
 * Reloads unless this mark has already been spent. Returns `false` when it has,
 * meaning the caller should show the reader something rather than ask again.
 *
 * `whenUnrecordable` answers the case where the mark cannot be stored at all.
 * There is no safe default, so each caller states its own:
 *
 * - `"retry"` for a caller that terminates by construction anyway, where the
 *   mark is a second belt rather than the stop. Reloading unrecorded is still a
 *   reload once, and declining would cost that reader a recovery that works.
 * - `"decline"` for a caller whose only stop *is* the mark. An unrecorded reload
 *   there is not a reload once, it is a reload loop — a worse thing to ship
 *   than the screen it was trying to avoid.
 */
export const reloadOnce = (mark: string, whenUnrecordable: "retry" | "decline"): boolean => {
  if (typeof window === "undefined") return false;

  const state = takeMark(mark);
  if (state === "spent") return false;
  if (state === "unrecordable" && whenUnrecordable === "decline") return false;

  window.location.reload();
  return true;
};

/**
 * Releases a mark once the thing it guards has been seen to work, so a reader
 * who sits through two deploys in one long-lived tab gets the recovery both
 * times rather than only the first.
 */
export const clearReloadMark = (mark: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(mark);
  } catch {
    // Nothing was recorded, so there is nothing to release.
  }
};
