import { clearReloadMark, reloadOnce } from "./reload-once";

/**
 * What to do when a post body fails to arrive.
 *
 * Bodies are only fetched on a client-side navigation — a first load reads the
 * body back out of the prerendered HTML and never asks the network. That fetch
 * is a dynamic import of a content-hashed chunk, and the case where it fails is
 * ordinary rather than exotic: Pages replaces `dist/` wholesale on deploy, so a
 * reader whose tab was open beforehand is holding a bundle whose chunk URLs no
 * longer exist. They click a post, the import rejects, and the page renders its
 * title, subtitle and hero above an empty article.
 *
 * The recovery is a full page load of the URL the reader is already on, because
 * that URL serves the body in its markup. See `reload-once` for the shape; what
 * is specific here is the key.
 *
 * Marked per slug rather than per tab because this failure is per post: the
 * chunk that went missing holds one post's text, and a reader who hits it on
 * one post has lost nothing on any other. (The route chunk one level up is the
 * opposite case, and is marked per tab — see `lazy-route`.)
 *
 * It also terminates by construction rather than by luck. After the reload the
 * router key is `default`, `prerenderedBody` finds the body, and the effect that
 * fetches never runs at all. The `sessionStorage` mark is a second belt for the
 * case that reasoning does not cover — a post reachable client-side whose HTML
 * has no body — where a reload would otherwise land on the same empty page and
 * ask for another one.
 */

const key = (slug: string) => `post-body-reload:${slug}`;

/**
 * Reloads once per slug per tab. Returns `false` when it has already tried and
 * the caller should show the reader something instead of asking again.
 */
export const recoverPostBody = (slug: string): boolean => reloadOnce(key(slug), "retry");

/**
 * Clears the mark once a body has been read successfully, so a reader who hits
 * this twice in one long-lived tab — two deploys, two stale chunks — gets the
 * recovery both times rather than only the first.
 *
 * The caller has to call this on the *prerendered* path and not only after a
 * successful fetch. A recovery reload delivers the body in the HTML, which is
 * the path described above and the one where no fetch happens at all — so a
 * clear hung off the import's `.then` is unreachable on precisely the journey
 * that spends the mark.
 */
export const clearPostBodyRecovery = (slug: string): void => clearReloadMark(key(slug));
