import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useMotionFeaturesReady } from "@/lib/motion-ready";

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

/**
 * The second suppression case is the animation features not being here yet.
 * They load from their own chunk, and until it lands `m` can write `initial`
 * into the inline style but cannot run the variant that clears it — so a
 * navigation made inside that window would leave the incoming route sitting at
 * `opacity: 0` for as long as the chunk took. Skipping the entrance costs that
 * one navigation its decoration; keeping it costs the reader the page.
 */
export const useEntrance = () => {
  const firstLoad = useFirstLoad();
  const motionReady = useMotionFeaturesReady();
  const suppressed = firstLoad || !motionReady;

  return useCallback(
    <T,>(initial: T): T | false => (suppressed ? false : initial),
    [suppressed]
  );
};
