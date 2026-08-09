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
 * that URL serves the body in its markup. It is not a retry in the hopeful
 * sense — the served HTML cannot 404 the way the stale chunk did, and it needs
 * no chunk to render.
 *
 * It also terminates by construction rather than by luck. After the reload the
 * router key is `default`, `prerenderedBody` finds the body, and the effect that
 * fetches never runs at all. The `sessionStorage` mark is a second belt for the
 * case that reasoning does not cover — a post reachable client-side whose HTML
 * has no body — where a reload would otherwise land on the same empty page and
 * ask for another one.
 */

const key = (slug: string) => `post-body-reload:${slug}`;

/** `sessionStorage` throws in Safari's private mode rather than no-opping. */
const session = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/**
 * Reloads once per slug per tab. Returns `false` when it has already tried and
 * the caller should show the reader something instead of asking again.
 */
export const recoverPostBody = (slug: string): boolean => {
  if (typeof window === "undefined") return false;

  const store = session();
  if (store?.getItem(key(slug))) return false;
  store?.setItem(key(slug), "1");

  window.location.reload();
  return true;
};

/**
 * Clears the mark once a body has been read successfully, so a reader who hits
 * this twice in one long-lived tab — two deploys, two stale chunks — gets the
 * recovery both times rather than only the first.
 */
export const clearPostBodyRecovery = (slug: string): void => {
  if (typeof window === "undefined") return;
  session()?.removeItem(key(slug));
};
