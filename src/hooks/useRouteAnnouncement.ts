import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { routeTitle } from "@/lib/route-title";

/**
 * The text to put in the live region so a client-side navigation is announced.
 *
 * A full page load announces itself: the browser tells a screen reader the new
 * document's title. A client-side navigation does not — the content swaps, the
 * `<title>` changes, and nothing says so. This site had neither of the two
 * mechanisms that produce an announcement: no live region anywhere, and nothing
 * moving focus into the incoming route. A reader following a link was left with
 * no signal that anything had happened.
 *
 * The live region is the right half of that pair here. Focusing the incoming
 * `<main>` is the other conventional answer, and `useRouteFocusReset` already
 * deliberately declines it — focus goes to `<body>` so the tab order matches a
 * fresh load, rather than landing the reader past the navbar. That decision
 * leaves the announcement to a live region, which is also the more faithful
 * echo of what a fresh load does: it says the title, it does not move you.
 *
 * The text comes from `routeTitle(pathname)`, never from `document.title`. See
 * src/lib/route-title.ts for why the DOM is not a safe source at route-change
 * time.
 *
 * Keyed on `key` as well as `pathname` so a navigation that lands on the same
 * path still counts — `/blog/` -> a post -> Back is three history entries and
 * two of them are the archive. (React bails out of a `setState` to the same
 * string, so a same-title navigation mutates nothing and announces nothing,
 * which is correct: the reader is where they already were.)
 *
 * Not on mount, for the same reason `useRouteFocusReset` is not: the first load
 * is the case the browser already announces. Firing here would double it, and
 * would also write text into the region that the prerenderer would then bake
 * into every route's HTML — a stale title sitting in a live region on arrival.
 *
 * The announcement fires when the location changes, which is up to the 300ms
 * exit transition before the incoming page is on screen. That ordering is
 * deliberate: `polite` queues behind whatever is being read, and naming the
 * destination as the reader leaves is how a fresh load behaves too. What must
 * never happen is naming the *outgoing* page, and route-derived text cannot.
 */
export const useRouteAnnouncement = (): string => {
  const { pathname, key } = useLocation();
  const [message, setMessage] = useState("");
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setMessage(routeTitle(pathname));
  }, [key, pathname]);

  return message;
};
