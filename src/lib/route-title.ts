import { matchPath } from "react-router-dom";
import { getPostBySlug } from "@/data/blog-posts/registry";
import { POST_PATH } from "@/routes";

/**
 * Every route's document title, in one place, resolvable from a pathname alone.
 *
 * Two things read these. Each page hands its own constant to `<SEO>` (or, on
 * 404, straight to `<Helmet>`), and `useRouteAnnouncement` resolves one from
 * `useLocation().pathname` to announce a client-side navigation. They have to
 * agree: an announcement that does not match the title the same page sets is a
 * reader being told the wrong thing about where they are.
 *
 * Resolving from the pathname is the point, not a convenience. The obvious
 * source for an announcement is `document.title`, and it is the wrong one:
 * react-helmet-async writes it asynchronously, outside React's commit, so a
 * route-change effect reading it gets the *outgoing* page's title far more
 * often than not. `AnimatePresence mode="wait"` widens that window to the full
 * 300ms exit transition — the location changes long before the incoming page
 * has rendered, let alone had its Helmet flushed. Route data has no such
 * window: `/blog/agents-fail-quietly/` names its title the instant the URL
 * changes, and cannot name a stale one.
 */

/** The attribution every title carries. Matches `SITE_NAME` in SEO.tsx. */
const SITE_NAME = "Pratik Patel";

export const HOME_TITLE = `${SITE_NAME} — CTO & Chief Architect`;
export const BLOG_TITLE = `Blog — ${SITE_NAME}`;
export const NOT_FOUND_TITLE = `404 — Page Not Found | ${SITE_NAME}`;

export const postTitle = (title: string): string => `${title} — ${SITE_NAME}`;

/**
 * The title the page at `pathname` sets, or the 404 title when nothing renders
 * there.
 *
 * Matched with the router's own `matchPath` against the same `POST_PATH` that
 * App.tsx hands to `<Route>`, so "is this a post URL" has one definition. v6's
 * matcher ignores a trailing slash, which every URL on this site carries.
 *
 * An unknown slug resolves to the 404 title because that is what the route
 * actually renders: BlogPost returns `<NotFound />` when the registry has no
 * post for the slug.
 */
export const routeTitle = (pathname: string): string => {
  if (matchPath("/", pathname)) return HOME_TITLE;
  if (matchPath("/blog", pathname)) return BLOG_TITLE;

  const match = matchPath(POST_PATH, pathname);
  const post = match?.params.slug ? getPostBySlug(match.params.slug) : undefined;

  return post ? postTitle(post.title) : NOT_FOUND_TITLE;
};
