/**
 * How far the reader has travelled through an article, as a 0–100 percentage.
 *
 * `articleTop` is the article's document Y (bounding-top + scrollY).
 * Progress is 0 until the top of the article reaches the top of the viewport,
 * and 100 when the bottom of the article reaches the bottom of the viewport —
 * i.e. when there is nothing left below to bring into view. An article shorter
 * than the viewport is 100 the moment its top has been reached: there is no
 * remaining travel, and reporting 0 for a fully-visible post would be a lie.
 */
export const readingProgress = (
  articleTop: number,
  articleHeight: number,
  scrollY: number,
  viewportHeight: number
): number => {
  const end = articleTop + articleHeight - viewportHeight;
  if (end <= articleTop) return scrollY >= articleTop ? 100 : 0;
  const raw = ((scrollY - articleTop) / (end - articleTop)) * 100;
  return Math.min(100, Math.max(0, raw));
};
