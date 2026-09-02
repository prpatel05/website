export type Tagged = { tags: readonly string[] };

export const ARCHIVE_HREF = "/blog/";

export function uniqueTags(posts: readonly Tagged[]): string[] {
  const seen = new Set<string>();
  for (const post of posts) {
    for (const tag of post.tags) {
      if (tag) seen.add(tag);
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export function normalizeArchiveTag(tag: string | null): string | null {
  if (tag == null) return null;
  const trimmed = tag.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function postsWithTag<T extends Tagged>(
  posts: readonly T[],
  tag: string | null
): T[] {
  const active = normalizeArchiveTag(tag);
  if (!active) return [...posts];
  return posts.filter((post) => post.tags.includes(active));
}

export function archiveTagHref(tag: string): string {
  return `${ARCHIVE_HREF}?${new URLSearchParams({ tag })}`;
}
