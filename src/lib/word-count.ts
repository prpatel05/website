/**
 * Words in an HTML fragment, after tags are stripped.
 *
 * Used for BlogPosting.wordCount. Empty markup is `undefined` rather than 0 so
 * a JSON-LD object built before the body arrives does not claim the post is
 * empty — JSON.stringify drops `undefined`, so the field is omitted until the
 * body is in.
 */
export function wordCountFromHtml(html: string): number | undefined {
  const text = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return undefined;
  return text.split(" ").length;
}
