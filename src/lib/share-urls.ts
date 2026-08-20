import { canonicalUrl } from "./canonical-url";

/**
 * The feed readers poll. A file, not a directory, so GitHub Pages serves it
 * without a trailing-slash redirect — `canonicalUrl` already knows that, but
 * callers constructing a subscribe link should not have to remember.
 */
export const RSS_URL = "https://pratik.pa.tel/rss.xml";

/** The URL a reader should copy or hand to a share intent: trailing slash, production origin. */
export function postCanonicalUrl(slug: string): string {
  return canonicalUrl(`https://pratik.pa.tel/blog/${slug}`);
}

/**
 * X's web intent. `text` + `url` rather than stuffing the URL into the body:
 * the composer still pre-fills the title, and X can attach the card from `url`.
 * No SDK — a GET a new tab can open.
 */
export function xShareUrl(url: string, title: string): string {
  return `https://x.com/intent/tweet?${new URLSearchParams({ text: title, url })}`;
}

/**
 * LinkedIn's share-offsite intent accepts only `url`. The title and card come
 * from the page's Open Graph tags, which the post already declares.
 */
export function linkedInShareUrl(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url })}`;
}
