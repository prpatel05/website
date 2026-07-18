/**
 * GitHub Pages serves every directory route from its index.html at the
 * trailing-slash URL, and 301-redirects the slashless form to it. A canonical
 * or og:url without the slash therefore points at a redirect: search engines
 * report it as "page with redirect", and social scrapers take an extra hop and
 * can split engagement between the two URL forms.
 *
 * Normalizing here means callers can keep passing the natural slashless path.
 */
export function canonicalUrl(url: string): string {
  const [withoutHash, ...hashParts] = url.split("#");
  const [path, ...queryParts] = withoutHash.split("?");

  // A path whose last segment carries a file extension (/sitemap.xml) is a real
  // file, not a directory index — GitHub Pages serves it without a redirect.
  const lastSegment = path.slice(path.lastIndexOf("/") + 1);
  const needsSlash = !path.endsWith("/") && !lastSegment.includes(".");

  const normalizedPath = needsSlash ? `${path}/` : path;
  const query = queryParts.length ? `?${queryParts.join("?")}` : "";
  const hash = hashParts.length ? `#${hashParts.join("#")}` : "";

  return `${normalizedPath}${query}${hash}`;
}
