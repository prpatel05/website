import type { BlogPost } from "@/data/blog-posts/types";

/**
 * The description for surfaces that render it detached from the title — meta,
 * og/twitter, JSON-LD and RSS. A subtitle written to sit under a headline can
 * be a fragment ("And How It Can Save Your Sanity"), which reads as broken copy
 * alone in a search result or a feed reader row; `description` is the override
 * for those posts. Everything that renders the subtitle *next to* the title
 * keeps reading `post.subtitle` directly.
 */
export function postDescription(
  post: Pick<BlogPost, "subtitle"> & { description?: string }
): string {
  return post.description?.trim() || post.subtitle;
}
