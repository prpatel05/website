/**
 * Which overlays are open, in the order they opened — innermost last.
 *
 * Ctrl+K works while the mobile menu is up, so the site has a genuine
 * two-overlay state; `useScrollLock` has been refcounted for it since PRA-886.
 * Everything else about the pair was decided independently by each component,
 * and all three of those decisions were wrong (PRA-912):
 *
 * - Two window-level Escape handlers, so one press closed *both* overlays. The
 *   terminal's trap then restored focus into the menu while it was 300ms into
 *   its exit animation; when that node was removed it took Chrome's sequential
 *   focus navigation starting point with it, and the next Tab resumed from the
 *   middle of the document, past the whole of the site navigation.
 * - Two capture-phase Tab traps, each seeing focus "outside my container" and
 *   yanking it back. Measured: six Tabs with both open never moved off "Close
 *   terminal" — perfectly contained, and the command line unreachable.
 * - Two `aria-modal="true"` dialogs, each telling a screen reader it is the only
 *   thing on the page.
 *
 * All three need the same fact, which no component can know on its own: am I on
 * top? The count lives at module scope because that is the scope of the thing
 * being answered.
 */
const stack: HTMLElement[] = [];

/**
 * The covered overlay is painted, unreachable, and still in the accessibility
 * tree. `inert` is the one thing that fixes all of that at once — it drops the
 * subtree from the tab order, from hit-testing and from the accessibility tree
 * — where `aria-hidden` would leave it tabbable and `pointer-events` would
 * leave it announced.
 *
 * Re-applied over the whole stack on every change rather than toggled on the
 * two overlays involved: the attribute then describes the stack rather than the
 * history of how it got here, so an unmount that skips a step cannot leave a
 * layer inert forever.
 */
const syncInert = () => {
  for (const container of stack) {
    if (container === topOverlay()) container.removeAttribute("inert");
    else container.setAttribute("inert", "");
  }
};

/** The overlay currently on top, or `null` when none is open. */
export const topOverlay = (): HTMLElement | null => stack[stack.length - 1] ?? null;

export const isTopOverlay = (container: HTMLElement) => topOverlay() === container;

/**
 * Registers an open overlay and returns the function that closes the books on
 * it.
 *
 * Unregistering is deliberately the caller's *first* act on close, ahead of
 * restoring focus: the node being restored to is often inside the overlay this
 * just uncovered, and `.focus()` inside an `inert` subtree is a silent no-op —
 * indistinguishable from success at the call site.
 */
export const registerOverlay = (container: HTMLElement) => {
  stack.push(container);
  syncInert();

  return () => {
    const i = stack.lastIndexOf(container);
    if (i !== -1) stack.splice(i, 1);
    syncInert();
  };
};

/**
 * Whether `node` sits inside an overlay that is on its way out of the document.
 *
 * This is the hole PRA-912 fell through. "Can this node take focus?" is usually
 * asked as `isConnected && getClientRects().length > 0`, and a control inside a
 * framer overlay mid-exit passes both for the full 300ms of the fade — it is in
 * the document, it has a box, and it is about to be removed with focus on it.
 *
 * No registry of closing overlays is needed to spot one: an overlay is open
 * exactly while it is on the stack, so a `role="dialog"` ancestor that is *not*
 * on the stack is by definition one that has already begun to leave.
 *
 * Which rests on every `role="dialog"` on the site going through
 * `useFocusTrap` — true of both of them, and the thing to fix rather than work
 * around if a third ever arrives, because a dialog with no trap has all of
 * PRA-912's problems on its own.
 */
export const isInsideClosingOverlay = (node: HTMLElement) => {
  const dialog = node.closest<HTMLElement>('[role="dialog"]');
  return !!dialog && !stack.includes(dialog);
};

/**
 * Whether `node` is underneath an overlay that is still open.
 *
 * Handing focus to a control outside the top overlay is the same defect
 * `useFocusTrap` exists to prevent, just reached from the other direction: the
 * reader ends up on something painted over and dropped from the accessibility
 * tree by `aria-modal`.
 */
export const isCoveredByOverlay = (node: HTMLElement) => {
  const top = topOverlay();
  return !!top && !top.contains(node);
};
