import { useEffect, type RefObject } from "react";

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
};

/**
 * Keeps keyboard focus inside an `aria-modal` overlay for as long as it is open,
 * and hands it back afterwards.
 *
 * Both of the site's overlays cover the whole viewport and mark themselves
 * `aria-modal="true"`, which drops the rest of the page out of the accessibility
 * tree. Without this, Tab walks straight out onto controls that are painted over
 * and no longer announced (WCAG 2.4.3), and the control that opened the dialog
 * keeps focus on a node the screen reader can no longer see.
 */
export const useFocusTrap = (
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  { initialFocus, fallbackFocus }: FocusTrapOptions = {}
) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;

    const openedFrom = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    if (!container.contains(document.activeElement)) {
      (initialFocus?.current ?? focusables()[0])?.focus();
    }

    // On the document and in the capture phase: a container-scoped listener
    // only ever sees the Tab presses that happen while focus is already inside,
    // which is exactly the case that does not need rescuing.
    const onKeyDown = (e: KeyboardEvent) => {
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
      // `<body>` is what `document.activeElement` reports when nothing is
      // focused at all — Ctrl+K on a page nobody has tabbed into yet.
      // "Restoring" to it is a no-op that strands the keyboard back at the top
      // of the document, so treat it like a node that has gone away.
      const returnable =
        openedFrom && openedFrom !== document.body && openedFrom.isConnected;
      // Reading `.current` at cleanup time is the point, not the mistake the
      // rule assumes: React reattaches refs during commit, before passive
      // effects, so by now this holds the button that closing just remounted.
      // A copy taken when the effect ran would be the stale, detached one.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const restoreTo = returnable ? openedFrom : fallbackFocus?.current;
      restoreTo?.focus();
    };
  }, [active, containerRef, initialFocus, fallbackFocus]);
};
