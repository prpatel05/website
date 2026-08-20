import type { BlogPost } from "@/data/blog-posts/types";

/**
 * The Jun–Aug 2026 reliability posts are a sequence in the copy — permissions,
 * undo, traces, handoffs — but the site-wide newer/older pager does not know
 * that. It walks the whole archive, so a hiring or career post sitting between
 * two of these looks like the next chapter.
 *
 * Membership is the tag pair, not a slug list. The weekly post that ships with
 * both `agents` and `reliability` joins on its own; a post that only has one
 * of them (permissions as product design, runbooks vs. prompts) stays out.
 * Exact tags, same rule as the archive filter: `"Agents"` is not `"agents"`.
 */
export const SERIES_NAME = "Agent reliability";
export const SERIES_TAGS = ["agents", "reliability"] as const;

export type SeriesTagged = Pick<BlogPost, "slug" | "title" | "dateISO" | "tags">;

export type SeriesPosition<T extends SeriesTagged = SeriesTagged> = {
  name: string;
  current: T;
  previous?: T;
  next?: T;
  /** 1-based index in reading order (oldest first). */
  index: number;
  total: number;
};

export function isSeriesMember(post: { tags: readonly string[] }): boolean {
  return SERIES_TAGS.every((tag) => post.tags.includes(tag));
}

/**
 * Members in reading order: oldest first, slug as a stable tie-break.
 *
 * Newest-first is the archive and the site-wide pager. A series is a sequence
 * you walk forward, so "1 of n" is the first post in the arc, not the latest.
 */
export function seriesMembers<T extends SeriesTagged>(posts: readonly T[]): T[] {
  return posts
    .filter(isSeriesMember)
    .slice()
    .sort(
      (a, b) =>
        a.dateISO.localeCompare(b.dateISO) || a.slug.localeCompare(b.slug)
    );
}

export function seriesPosition<T extends SeriesTagged>(
  posts: readonly T[],
  slug: string
): SeriesPosition<T> | null {
  const members = seriesMembers(posts);
  const i = members.findIndex((post) => post.slug === slug);
  if (i === -1) return null;
  return {
    name: SERIES_NAME,
    current: members[i],
    previous: members[i - 1],
    next: members[i + 1],
    index: i + 1,
    total: members.length,
  };
}
