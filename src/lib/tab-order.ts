/**
 * Puts the *sequential focus navigation starting point* back at the top of the
 * document, so the next Tab behaves like one pressed on a fresh load.
 *
 * Removing the focused node does not move that starting point: Chrome leaves it
 * at the removed node's position in the DOM, and the next Tab resumes from the
 * middle of the page. Neither does clearing focus — `blur()` sets
 * `document.activeElement` back to `<body>`, so it looks like it worked from
 * every angle except the one that matters. Focusing something is what moves it,
 * and `<body>` is the only thing to focus that does not also put the reader
 * somewhere a fresh load never starts.
 *
 * `<body>` is not focusable by default, so the attribute has to be there for the
 * call to land; it comes straight back off so the body does not become a Tab
 * stop of its own. `preventScroll` because this must never move the page —
 * scroll position belongs to whoever owns the navigation.
 *
 * Two callers, both of which unmount the node that had focus: a client-side
 * route change (`useRouteFocusReset`) and closing an overlay whose opener has
 * since gone away or gone `display:none` (`useFocusTrap`).
 */
export const resetTabOrder = () => {
  const { body } = document;
  body.setAttribute("tabindex", "-1");
  body.focus({ preventScroll: true });
  body.removeAttribute("tabindex");
};
