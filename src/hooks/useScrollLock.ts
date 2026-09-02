import { useEffect } from "react";

/**
 * Refcounted so the two overlays cannot unlock each other. Ctrl+K works while
 * the mobile menu is open, so both can be mounted at once, and a
 * lock-on-open/unlock-on-close pair per component would have the first close
 * release the page from under the second dialog. The count lives at module
 * scope because that is the scope of the thing being locked.
 */
let locks = 0;
let restore: (() => void) | null = null;

const lock = () => {
  if (locks++ > 0) return;

  const { body } = document;
  const overflow = body.style.overflow;
  const overscroll = body.style.overscrollBehavior;

  // `overflow` on `<body>` propagates to the viewport, which is what stops the
  // page rather than just the element. `overscroll-behavior: contain` is the
  // other half: without it a swipe that reaches the end of the overlay's own
  // scroll area chains out to the document behind it.
  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "contain";

  // Put back exactly what was there, not a hardcoded default — the page may own
  // these for its own reasons, and this hook is not the only writer forever.
  restore = () => {
    body.style.overflow = overflow;
    body.style.overscrollBehavior = overscroll;
  };
};

const unlock = () => {
  if (locks === 0) return;
  if (--locks > 0) return;
  restore?.();
  restore = null;
};

/**
 * Holds the page still while a full-screen overlay is open.
 *
 * Neither overlay touched this before. Both are `fixed inset-0` over a document
 * that was still perfectly scrollable, so a swipe anywhere over the backdrop
 * scrolled the page behind it: the overlay itself does not move, which reads as
 * frozen UI, and the reading position the visitor came from is gone by the time
 * they close it.
 *
 * Releasing is tied to the effect's cleanup rather than to `active` going false,
 * so an overlay that unmounts while open — a route change with the menu up —
 * still hands the page back.
 */
export const useScrollLock = (active: boolean) => {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
};
