/**
 * Formal series a post can belong to. Mirrors `SERIES` in
 * src/lib/blog-series.ts; a unit test keeps the two in step.
 */
export type SeriesId =
  | "agent-reliability"
  | "ship-with-agents"
  | "agents-in-production";

export interface BlogPost {
  slug: string;
  title: string;
  /**
   * The line rendered under the title. Written for the page, where the title
   * sits directly above it — so it is allowed to be a fragment.
   */
  subtitle: string;
  /**
   * Overrides `subtitle` on the surfaces that show a description with no title
   * next to it: meta/og/twitter, the JSON-LD, and the RSS feed. Set this when
   * the subtitle only reads correctly under its own headline. Optional — most
   * posts have a subtitle that stands alone.
   */
  description?: string;
  date: string;
  dateISO: string;
  readTime: string;
  tags: string[];
  image: string;
  /**
   * Explicit series membership. Set it on the post's own file to join a series
   * hub and its prev/next rail; order inside the series is `dateISO`. Wins over
   * the Agent reliability tag rule, so a post tagged `agents` + `reliability`
   * with `series: "agents-in-production"` is only in Agents in Production.
   * Leave it unset for a standalone post (or to let the tag rule decide).
   */
  series?: SeriesId;
}
