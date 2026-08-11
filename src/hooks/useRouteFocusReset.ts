import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Puts the tab order back at the top of the document after a client-side
 * navigation, so the skip link is the first thing Tab reaches — the same place
 * a fresh load starts.
 *
 * A route change unmounts the link the reader just activated, and Chrome leaves
 * the *sequential focus navigation starting point* at that removed node's
 * position in the DOM. That position is inside the router, which renders after
 * the skip link in App.tsx, so the next Tab resumes past it:
 *
 * ```
 * fresh load /            ["Skip to main content", "pratik.pa.tel", "about()", ...]
 * /blog/ -> / via link    ["pratik.pa.tel", "about()", "writing()", ...]
 * ```
 *
 * Shift+Tab still reaches the link, which is how we know it is present and
 * focusable and only the starting point is wrong. The cost is that a keyboard
 * reader who navigates within the site can no longer skip the navbar — which is
 * the entire job of the element they can no longer reach.
 *
 * `body.focus()` is the reset, and the two lines around it are what make it one.
 * `<body>` is not focusable by default, so the attribute has to be there for the
 * call to land; it comes straight back off so the body does not become a Tab
 * stop of its own. Measured against the three alternatives:
 *
 * | attempt                        | first Tab after a client nav |
 * | ------------------------------ | ---------------------------- |
 * | (none — shipped behaviour)     | `pratik.pa.tel`              |
 * | `document.activeElement.blur()` | `pratik.pa.tel`             |
 * | `main.focus({preventScroll})`  | `./contact --init`           |
 * | this                           | `Skip to main content`       |
 *
 * `blur()` is the one worth naming: it sets `document.activeElement` back to
 * `<body>`, so it looks like it worked from every angle except the one that
 * matters. Clearing focus does not move the starting point; focusing something
 * does.
 *
 * Focusing `<main>` is the other conventional answer and it is a different
 * behaviour, not a worse spelling of this one — it puts the reader *inside* the
 * content, past the navbar and past the skip link both. It is defensible, but it
 * makes a keyboard navigation land somewhere a fresh load never does, and it
 * gives up reaching the nav at all without a Shift+Tab. Matching the fresh load
 * is the smaller promise, so that is the one made here.
 *
 * `preventScroll` because this must not move the page. `ScrollToTop` owns the
 * offset on `PUSH` and `useScrollRestoration` owns it on `POP`, and both would
 * be fighting a focus call that scrolled.
 *
 * Not on mount. A cold load already starts at the top of the tab order, and the
 * one thing a reset could do there is take focus away from whatever the reader
 * or the browser had already put it on.
 *
 * Keyed on `key` rather than `pathname` so a navigation that lands on the same
 * path still counts — `/blog/` -> a post -> Back is three entries and two of
 * them are the archive.
 */
export const useRouteFocusReset = () => {
  const { key } = useLocation();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    const { body } = document;
    body.setAttribute("tabindex", "-1");
    body.focus({ preventScroll: true });
    body.removeAttribute("tabindex");
  }, [key]);
};
