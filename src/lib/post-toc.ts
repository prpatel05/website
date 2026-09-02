export type TocEntry = { id: string; text: string };

/**
 * H2s from a rendered post body, in document order.
 *
 * The body arrives as an HTML string — the Vite plugin's output — so the TOC
 * is derived from that string rather than from a second pass over the markdown.
 * A heading without an `id` is skipped: those are the levels the renderer
 * does not mint fragments for (h4–h6 today), and a TOC link with nowhere to
 * go is worse than a missing row.
 *
 * DOMParser rather than a regex so emphasis, code and entities inside a
 * heading become the same text the reader sees. The permalink wrapper is an
 * `<a>` around the words, not a "#" sibling, so `textContent` is already the
 * author's heading.
 */
export const tocFromHtml = (html: string): TocEntry[] => {
  if (!html || typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  return [...doc.querySelectorAll("h2[id]")]
    .map((heading) => ({
      id: heading.id,
      text: (heading.textContent ?? "").trim(),
    }))
    .filter((entry) => entry.id && entry.text);
};

/**
 * Which heading is current given each heading's viewport-top and a mark
 * just below the fixed nav. The last heading that has crossed the mark wins;
 * before any heading has, the first one is current so the TOC is never empty
 * of an active row on a post that has sections.
 */
export const activeHeadingId = (
  headings: { id: string; top: number }[],
  mark: number
): string => {
  if (headings.length === 0) return "";
  let current = headings[0].id;
  for (const heading of headings) {
    if (heading.top <= mark) current = heading.id;
  }
  return current;
};

/** Viewport Y that counts as "this heading is the one you are in". */
export const ACTIVE_HEADING_MARK = 96;
