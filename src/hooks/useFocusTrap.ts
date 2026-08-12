import { useEffect, useRef, type RefObject } from "react";
import { resetTabOrder } from "@/lib/tab-order";
import {
  isCoveredByOverlay,
  isInsideClosingOverlay,
  isTopOverlay,
  registerOverlay,
  topOverlay,
} from "@/lib/overlay-stack";

/**
 * Whether `.focus()` on this node will actually land.
 *
 * `isConnected` is not enough. The navbar's `[menu]` toggle is `md:hidden`, so
 * crossing the breakpoint with the menu open leaves it in the document and
 * `display:none`, where focusing it is a silent no-op — indistinguishable from
 * success at the call site, and it leaves the keyboard nowhere. An element with
 * no box has no client rects, which is close enough to what the browser asks:
 * it catches detached and `display:none` both. (`visibility:hidden` still has
 * rects and is still unfocusable; nothing on the site hides a control that way,
 * and the caller's `fallbackFocus` covers it if one ever does.)
 *
 * `inert` is the third silent no-op and the newest: a covered overlay is inert
 * while it is covered, and every control in it still reports connected with a
 * full-sized box.
 */
const canTakeFocus = (el: HTMLElement | null | undefined): el is HTMLElement =>
  !!el && el.isConnected && el.getClientRects().length > 0 && !el.closest("[inert]");

/**
 * Where the keyboard may be handed on close: somewhere it will still exist, and
 * somewhere the reader can still get at.
 *
 * `canTakeFocus` answers the first question about *now* and PRA-912 turned on
 * the difference — a button inside an overlay 300ms into its exit is connected,
 * has rects, and is gone a moment later, leaving the tab order pointing at the
 * hole. The other two clauses are the same question asked about the stack.
 */
const canRestoreTo = (el: HTMLElement | null | undefined): el is HTMLElement =>
  canTakeFocus(el) && !isInsideClosingOverlay(el) && !isCoveredByOverlay(el);

/**
 * Everything the browser puts in the tab order, minus the two ways an element
 * opts out: `tabindex="-1"` and `aria-hidden="true"` — the terminal's
 * macOS-style red dot carries both, and pulling it in would hand the keyboard a
 * stop that assistive tech cannot name.
 */
const FOCUSABLE = ["a[href]", "button", "input", "select", "textarea", "[tabindex]"]
  .map((sel) => `${sel}:not([disabled]):not([tabindex="-1"]):not([aria-hidden="true"])`)
  .join(",");

type FocusTrapOptions = {
  /** Where focus lands on open. Defaults to the first focusable in the container. */
  initialFocus?: RefObject<HTMLElement | null>;
  /**
   * Where focus lands on close when whatever opened the dialog is no longer in
   * the document. The terminal's floating toggle button unmounts while the
   * terminal is open, so by restore time the remembered node is detached and
   * focusing it would silently drop the keyboard on `<body>`.
   */
  fallbackFocus?: RefObject<HTMLElement | null>;
  /**
   * Dismiss this overlay. Called on Escape, and only while it is the overlay on
   * top — see the note on the hook about why this cannot be a window listener
   * in the component.
   */
  onEscape?: () => void;
};

/**
 * Owns the keyboard contract of an `aria-modal` overlay: focus goes in on open,
 * Tab stays inside, Escape dismisses, and focus comes back out on close.
 *
 * Both of the site's overlays cover the whole viewport and mark themselves
 * `aria-modal="true"`, which drops the rest of the page out of the accessibility
 * tree. Without the trap, Tab walks straight out onto controls that are painted
 * over and no longer announced (WCAG 2.4.3), and the control that opened the
 * dialog keeps focus on a node the screen reader can no longer see.
 *
 * Escape belongs here rather than in the component precisely because it is the
 * *same* question as the trap. Each overlay used to close itself from its own
 * window listener, which is correct for one overlay and wrong for two: Ctrl+K
 * works while the mobile menu is up, and one Escape then fired both handlers,
 * closed both overlays, and left the keyboard nowhere (PRA-912). Only the
 * overlay on top of `@/lib/overlay-stack` answers a key, so one press dismisses
 * one overlay and the trap underneath waits its turn.
 */
export const useFocusTrap = (
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  { initialFocus, fallbackFocus, onEscape }: FocusTrapOptions = {}
) => {
  // Read at keypress time, not captured by the effect. Callers pass an inline
  // arrow, so a new identity every render is guaranteed — putting it in the
  // deps below would re-run the effect on every render, and its cleanup is what
  // restores focus.
  const latestEscape = useRef(onEscape);
  latestEscape.current = onEscape;

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;

    const openedFrom = document.activeElement as HTMLElement | null;
    const unregister = registerOverlay(container);
    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    if (!container.contains(document.activeElement)) {
      (initialFocus?.current ?? focusables()[0])?.focus();
    }

    // On the document and in the capture phase: a container-scoped listener
    // only ever sees the Tab presses that happen while focus is already inside,
    // which is exactly the case that does not need rescuing.
    const onKeyDown = (e: KeyboardEvent) => {
      // Every open overlay has one of these bound to the document, so each one
      // has to decide whether the key is its to answer. Without this the
      // covered overlay's trap also handles Tab: it sees focus outside its own
      // container and drags it back, and with both open six Tabs never moved
      // off "Close terminal" while the command line stayed unreachable.
      if (!isTopOverlay(container)) return;

      if (e.key === "Escape") {
        latestEscape.current?.();
        return;
      }
      if (e.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const atEdge = document.activeElement === (e.shiftKey ? first : last);

      if (atEdge || !container.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // First, and before anything reads the stack or calls `.focus()`: this is
      // what un-inerts the overlay underneath, which is very often exactly
      // where focus is about to go back to.
      unregister();

      // Nothing to hand back if the keyboard was never here. An overlay can
      // close from *underneath* the one on top of it — the mobile menu does
      // exactly that when a resize crosses `md` with the terminal open — and
      // then focus is in the live overlay, not in the node being removed.
      // Restoring would drag the caret out of the terminal's command line to
      // rescue a keyboard that was never in danger. `<body>` is not "somewhere
      // else": it is the no-focus reading, and the case below is written for it.
      const focused = document.activeElement;
      if (focused && focused !== document.body && !container.contains(focused)) return;

      // In order of preference, and every one of them checked rather than
      // assumed:
      //
      // 1. Wherever the overlay was opened from — except `<body>`, which is
      //    what `document.activeElement` reports when nothing is focused at
      //    all (Ctrl+K on a page nobody has tabbed into, or any open in Safari
      //    or Firefox, neither of which focuses a `<button>` on click).
      //    "Restoring" to that is a no-op, so treat it as a node that is gone.
      // 2. The caller's fallback, for when the opener has since unmounted — the
      //    terminal's floating toggle does exactly that.
      // 3. The overlay this one was stacked on top of, which is still open and
      //    still modal. Its own trap will not re-focus anything by itself: its
      //    effect has not re-run, so without this the reader is left on a
      //    control it is covering.
      //
      // Reading `fallbackFocus.current` at cleanup time is the point, not the
      // mistake the lint rule assumes: React reattaches refs during commit,
      // before passive effects, so by now it holds the button that closing just
      // remounted. A copy taken when the effect ran would be the stale one.
      const uncovered = topOverlay();
      const restoreTo = [
        openedFrom === document.body ? null : openedFrom,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        fallbackFocus?.current,
        uncovered?.querySelector<HTMLElement>(FOCUSABLE),
      ].find(canRestoreTo);

      // Landing nowhere is not neutral. The dialog node focus is sitting on is
      // being removed, and an unfocused removal leaves the tab order pointing
      // into the hole it left, so the reader's next Tab resumes from the middle
      // of the document. If there is no control to hand back to, say so
      // explicitly rather than by omission.
      if (restoreTo) restoreTo.focus();
      else resetTabOrder();
    };
  }, [active, containerRef, initialFocus, fallbackFocus]);
};
