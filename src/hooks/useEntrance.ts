import { useCallback } from "react";
import { useLocation } from "react-router-dom";

/**
 * Wraps a framer-motion `initial` value so entrance animations only run on
 * client-side navigations.
 *
 * The prerender puts a fully rendered page in the HTML, but framer-motion
 * bakes `initial` into it as an inline style — so every route shipped at
 * `opacity: 0` and stayed invisible until React had downloaded, hydrated and
 * finished animating. The homepage HTML was complete at 795ms and did not
 * paint until 1996ms, with LCP at 2840ms. Returning `false` mounts straight
 * into the `animate` state, which leaves the prerendered markup on screen.
 *
 * The signal is the router's location key rather than a mount flag: react-router
 * labels the entry the document loaded with `"default"` and gives every later
 * entry a generated key. That is true during prerendering too, so the captured
 * HTML never contains the hidden state in the first place — no timing
 * assumption about when hydration or a lazy route chunk happens to finish.
 */

/**
 * The raw "this document was loaded, not navigated to" signal, for the callers
 * that need it as a boolean rather than as an `initial` wrapper — a
 * scroll-linked `style` value cannot be switched off with `false`, it has to be
 * left off the element entirely. See `useScrollAnimation`.
 */
export const useFirstLoad = () => useLocation().key === "default";

export const useEntrance = () => {
  const firstLoad = useFirstLoad();

  return useCallback(
    <T,>(initial: T): T | false => (firstLoad ? false : initial),
    [firstLoad]
  );
};
