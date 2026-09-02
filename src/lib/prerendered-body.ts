/**
 * Marks the element that carries a post body, so the body can be read back off
 * the page it was prerendered into.
 */
export const POST_BODY_ATTR = "data-post-body";

/**
 * The prerendered post body, read out of the DOM the page is about to hydrate
 * into.
 *
 * The post page's `content` used to start empty and fill from an async import.
 * That made the client's first render disagree with the served HTML on the one
 * subtree that matters, so React dropped the article and rebuilt it — after a
 * round trip for a chunk the preload scanner could not see, a chained dynamic
 * import being undiscoverable until React has mounted. Seeding from `innerHTML`
 * cannot disagree: the string is the DOM's own serialization of the very markup
 * React is about to check it against. It also means a first load fetches no
 * post chunk at all.
 *
 * The attribute carries the slug, so a client-side navigation can never adopt
 * an outgoing post's markup, and the caller pairs this with `useFirstLoad` so
 * it only ever reads HTML the server sent rather than HTML React itself wrote.
 * The slug is compared as an attribute value rather than interpolated into the
 * selector: it arrives from the URL, and an odd one would make `querySelector`
 * throw.
 */
export const prerenderedBody = (slug: string | undefined): string => {
  if (!slug || typeof document === "undefined") return "";
  const el = document.querySelector(`[${POST_BODY_ATTR}]`);
  return el?.getAttribute(POST_BODY_ATTR) === slug ? el.innerHTML : "";
};
