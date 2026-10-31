import { matchPath } from "react-router-dom";
import { lazyRoute } from "@/lib/lazy-route";

// The post page is the only screen that shows a post body, so its markup and
// the per-post HTML it imports stay out of the chunk the homepage and archive
// load. (The markdown parser itself no longer ships at all — see
// scripts/markdown-html.mjs.)
//
// `lazyRoute` rather than `React.lazy` so src/main.tsx can get the chunk into
// memory before it hydrates: a route that suspends mid-hydration loses the
// prerendered markup it was supposed to adopt. See src/lib/lazy-route.ts.
export const BlogPostRoute = lazyRoute(() => import("./pages/BlogPost.tsx"));

/** The post route, whose component is not in the entry chunk. */
export const POST_PATH = "/blog/:slug";

// /book/ is a page few readers open, and it hosts the Cal.com embed. Lazy so
// its shell (and the import that loads Cal) adds nothing to the homepage's
// entry chunk. Same `lazyRoute` contract as the post page.
export const BookRoute = lazyRoute(() => import("./pages/Book.tsx"));

export const BOOK_PATH = "/book";

/**
 * Resolves once the component for `pathname` can render synchronously. Awaited
 * by src/main.tsx before hydrating; a no-op for every route whose component
 * already ships in the entry chunk. The lazy ones are the post page and /book/.
 *
 * Matched with the router's own `matchPath` against the same pattern App.tsx
 * hands to `<Route>`, so there is no second definition of "is this a post URL"
 * to fall out of step — a mismatch would hydrate a post page before its chunk
 * had arrived, which is exactly the failure the preload exists to prevent.
 */
export const preloadRoute = (pathname: string): Promise<void> => {
  if (matchPath(POST_PATH, pathname)) return BlogPostRoute.preload();
  if (matchPath(BOOK_PATH, pathname)) return BookRoute.preload();
  return Promise.resolve();
};
