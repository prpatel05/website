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
 * gives every entry a key, and comparing against the one this document loaded
 * on says whether the markup on screen is still the server's. That is true
 * during prerendering too, so the captured HTML never contains the hidden state
 * in the first place — no timing assumption about when hydration or a lazy
 * route chunk happens to finish.
 */

/**
 * The key of the history entry this document was loaded onto.
 *
 * `"default"` — react-router's label for an entry it did not push — is only
 * right for an entry the router has never seen. It is wrong for the ordinary
 * case of a reader pressing reload on a page they arrived at by clicking a
 * link: react-router keeps its key in `history.state`, the browser restores
 * that state before any script runs, and the reloaded document comes up on the
 * generated key it was pushed with.
 *
 * Comparing against `"default"` therefore called a genuine document load a
 * client-side navigation. On a post that meant `prerenderedBody` was never
 * read, so React hydrated an empty article against served HTML holding the
 * whole body: two `#418` text mismatches and a `#423` recovery, the article
 * subtree thrown away and rebuilt, and a network round trip for a body that had
 * already arrived in the HTML. Read at module scope because that is exactly
 * once per document, which is the thing being identified.
 */
const loadedOnKey =
  typeof window === "undefined"
    ? "default"
    : ((window.history.state as { key?: string } | null)?.key ?? "default");

/**
 * The raw "this document was loaded, not navigated to" signal, for the callers
 * that need it as a boolean rather than as an `initial` wrapper — a
 * scroll-linked `style` value cannot be switched off with `false`, it has to be
 * left off the element entirely. See `useScrollAnimation`.
 */
export const useFirstLoad = () => useLocation().key === loadedOnKey;

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

/**
 * The same wrapper for an element that only ever mounts because the reader
 * asked for it — the terminal overlay, the mobile menu.
 *
 * Only the second suppression case applies to those. They are behind an `open`
 * flag that starts `false`, so they are never in the prerendered HTML and there
 * is no baked-in `initial` for the first load to protect against. Reusing
 * `useEntrance` here would suppress on `firstLoad` too, and since a reader
 * almost always opens an overlay on the page they loaded rather than one they
 * navigated to, that would cost the animation in the common case to fix a
 * problem the overlay does not have.
 *
 * What it does share is the missing-features window, and there it is worse than
 * a route entrance rather than better. The terminal's is not a race at all:
 * `index.html` holds a pre-hydration Ctrl+K and `InteractiveTerminal` claims it
 * in a mount-only effect, so that overlay opens on the very first commit —
 * always before a dynamically imported chunk can have resolved. It mounted at
 * `opacity: 0`, the focus trap put the caret in the input, and the reader typed
 * into a dialog they could not see. The menu is the same defect on a slower
 * trigger: a `fixed inset-0` layer, transparent and swallowing every tap.
 *
 * Safe to resolve to `false` because both overlays animate *to* the CSS default
 * of every property they touch — opacity 1, no offset, no scale — so mounting
 * straight into the `animate` state needs nothing framer has not loaded yet.
 */
export const useOverlayEntrance = () => {
  const motionReady = useMotionFeaturesReady();

  return useCallback(
    <T,>(initial: T): T | false => (motionReady ? initial : false),
    [motionReady]
  );
};
