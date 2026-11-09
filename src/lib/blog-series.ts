import type { BlogPost, SeriesId } from "@/data/blog-posts/types";

export type { SeriesId } from "@/data/blog-posts/types";

/**
 * Formal series on the blog. Each one is a hub at `/blog/series/<id>/` plus a
 * prev/next rail on every member post. The site-wide newer/older pager walks
 * the whole archive, so a hiring or career post sitting between two chapters
 * looks like the next one; the rail is what keeps a series in order.
 *
 * Membership, in priority order:
 *
 * 1. Explicit. A post that sets `series: "<id>"` in its own metadata file
 *    belongs to that series and no other. This is how Ship With Agents and
 *    Agents in Production join: both are editorial slates, and their posts
 *    share tags with other arcs (Agents in Production posts carry
 *    `agents` + `reliability` like the reliability arc does), so no tag rule
 *    separates them cleanly. The field lives on the post file, not in a shared
 *    list here, so a queued post never edits the same lines as another one.
 * 2. Tag pair, for Agent reliability only. A post with both `agents` and
 *    `reliability` and no explicit `series` joins on its own, which is how the
 *    Jun to Aug 2026 arc grew. Exact tags, same rule as the archive filter:
 *    `"Agents"` is not `"agents"`.
 *
 * A post is in at most one series.
 */
export type SeriesDefinition = {
  id: SeriesId;
  name: string;
  /** Bare path for `<Route path>`. */
  path: string;
  /**
   * Trailing slash is load-bearing on GitHub Pages; use this for every link
   * and canonical.
   */
  href: string;
  /** Shared by the hub page, its `<title>`/`meta`, and JSON-LD. */
  description: string;
  /** Optional implicit rule. Only Agent reliability has one. */
  tags?: readonly string[];
};

const hub = (id: SeriesId) => ({
  path: `/blog/series/${id}`,
  href: `/blog/series/${id}/`,
});

export const AGENT_RELIABILITY: SeriesDefinition = {
  id: "agent-reliability",
  name: "Agent reliability",
  ...hub("agent-reliability"),
  // Claimy on purpose: this is the reliability half of agent work, not a soft
  // "best practices" list.
  description:
    "Most agent demos stop at \"it worked once.\" This series is the other half: permissions, undo, traces, handoffs, evals. The reliability work you do before autonomy is safe to ship.",
  tags: ["agents", "reliability"],
};

export const SHIP_WITH_AGENTS: SeriesDefinition = {
  id: "ship-with-agents",
  name: "Ship With Agents",
  ...hub("ship-with-agents"),
  description:
    "Agents do not ship software because you bought a seat. This series is the working setup that makes them ship: runs that last for days, a stack staffed like a team, a phone that counts as a dev machine, the right model for each job, and clear ownership when agents run in parallel.",
};

export const AGENTS_IN_PRODUCTION: SeriesDefinition = {
  id: "agents-in-production",
  name: "Agents in Production",
  ...hub("agents-in-production"),
  description:
    "A demo agent gets one clean run. A production agent gets retries, stalls, interventions, and plans that go stale while it works. This series is about the agent after launch, where the failures are quiet and the fix is in the system, not the prompt.",
};

/** Every series, in the order the archive lists them. */
export const SERIES: readonly SeriesDefinition[] = [
  AGENT_RELIABILITY,
  SHIP_WITH_AGENTS,
  AGENTS_IN_PRODUCTION,
];

export const SERIES_IDS: readonly SeriesId[] = SERIES.map((s) => s.id);

export function getSeries(id: SeriesId): SeriesDefinition {
  const found = SERIES.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown series: ${id}`);
  return found;
}

export function isSeriesId(value: unknown): value is SeriesId {
  return typeof value === "string" && (SERIES_IDS as readonly string[]).includes(value);
}

/*
 * Agent reliability keeps its original single-series exports. The homepage,
 * archive, footer, and 404 link to it as "the" series, and tests pin it.
 */
export const SERIES_NAME = AGENT_RELIABILITY.name;
export const SERIES_TAGS = AGENT_RELIABILITY.tags!;
export const SERIES_PATH = AGENT_RELIABILITY.path;
export const SERIES_HREF = AGENT_RELIABILITY.href;
export const SERIES_DESCRIPTION = AGENT_RELIABILITY.description;

export type SeriesTagged = Pick<BlogPost, "slug" | "title" | "dateISO" | "tags"> &
  Partial<Pick<BlogPost, "series">>;

export type SeriesPosition<T extends SeriesTagged = SeriesTagged> = {
  /** Series id. Optional so older callers that only paint a name still type. */
  id?: SeriesId;
  name: string;
  /** Hub link with its trailing slash. Defaults to Agent reliability. */
  href?: string;
  current: T;
  previous?: T;
  next?: T;
  /** 1-based index in reading order (oldest first). */
  index: number;
  total: number;
};

/** The one series a post belongs to, or null. */
export function seriesIdOf(post: {
  tags: readonly string[];
  series?: SeriesId;
}): SeriesId | null {
  if (post.series) return post.series;
  for (const s of SERIES) {
    if (s.tags && s.tags.every((tag) => post.tags.includes(tag))) return s.id;
  }
  return null;
}

export function isInSeries(
  post: { tags: readonly string[]; series?: SeriesId },
  id: SeriesId
): boolean {
  return seriesIdOf(post) === id;
}

/**
 * Agent reliability membership. Single-argument on purpose so it stays safe as
 * an `Array.prototype.filter` callback (a second positional parameter would
 * receive the index).
 */
export function isSeriesMember(post: {
  tags: readonly string[];
  series?: SeriesId;
}): boolean {
  return isInSeries(post, AGENT_RELIABILITY.id);
}

/**
 * Members in reading order: oldest first, slug as a stable tie-break.
 *
 * Newest-first is the archive and the site-wide pager. A series is a sequence
 * you walk forward, so "1 of n" is the first post in the arc, not the latest.
 */
export function seriesMembers<T extends SeriesTagged>(
  posts: readonly T[],
  id: SeriesId = AGENT_RELIABILITY.id
): T[] {
  return posts
    .filter((post) => isInSeries(post, id))
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
  const post = posts.find((p) => p.slug === slug);
  if (!post) return null;
  const id = seriesIdOf(post);
  if (!id) return null;
  const series = getSeries(id);
  const members = seriesMembers(posts, id);
  const i = members.findIndex((p) => p.slug === slug);
  if (i === -1) return null;
  return {
    id,
    name: series.name,
    href: series.href,
    current: members[i],
    previous: members[i - 1],
    next: members[i + 1],
    index: i + 1,
    total: members.length,
  };
}
