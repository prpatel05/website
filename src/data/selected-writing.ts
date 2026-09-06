/**
 * Homepage "Selected writing" curation.
 *
 * Kept as an explicit slug list — not "newest N" from the registry — so the
 * homepage showcases claim posts rather than whatever shipped last. Do not
 * edit registry.ts for this; add or reorder slugs here.
 *
 * Mix: two strong pieces from the Agent reliability arc + one outsider claim
 * post that still fits the homepage pitch.
 */
import { getPostBySlug, type BlogPost } from "@/data/blog-posts/registry";

export const SELECTED_WRITING_SLUGS = [
  "the-handoff-is-where-agents-break",
  "give-your-agent-an-undo-button",
  "the-entry-level-job-is-the-canary",
] as const;

export type SelectedWritingSlug = (typeof SELECTED_WRITING_SLUGS)[number];

/**
 * Resolve the curated slug list against the live registry. Missing slugs are
 * dropped rather than crashing the homepage — a renamed post should fail soft
 * until this file is updated.
 */
export function resolveSelectedWriting(): BlogPost[] {
  return SELECTED_WRITING_SLUGS.map((slug) => getPostBySlug(slug)).filter(
    (post): post is BlogPost => Boolean(post)
  );
}
