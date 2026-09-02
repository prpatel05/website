import { useSyncExternalStore } from "react";

/**
 * Tracks whether framer-motion's animation feature set has finished loading.
 *
 * The features live in their own async chunk (see `motion-features`), so there
 * is a window between hydration and that chunk landing. Inside it `m` renders
 * and honours scroll-linked `style` — both are core — but it cannot run a
 * variant, so an element mounted with `initial: { opacity: 0 }` writes that
 * inline style and has nothing to animate it away. On a client-side navigation
 * that is a page the reader cannot see, for as long as the chunk takes.
 *
 * `useEntrance` reads this and suppresses the entrance until the features are
 * here, which turns a slow chunk into a missing animation rather than a blank
 * page. Deliberately free of any framer-motion import: this module is pulled in
 * eagerly, and importing the package here would drag the chunk back onto the
 * critical path it was split off.
 */

let ready = false;
const listeners = new Set<() => void>();

export const markMotionFeaturesReady = () => {
  if (ready) return;
  ready = true;
  listeners.forEach((notify) => notify());
};

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};

/**
 * `false` during prerendering, matching the client's first paint: the captured
 * HTML must not contain a hidden state either way, and the entrance is
 * suppressed on the document's first load regardless.
 */
export const useMotionFeaturesReady = () =>
  useSyncExternalStore(
    subscribe,
    () => ready,
    () => false
  );
