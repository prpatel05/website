export type { BlogPost } from "./types";
import type { BlogPost } from "./types";

// Posts are discovered from this directory rather than listed by hand. A shared
// list makes every queued post edit the same two lines, so two posts in flight
// at once always collide; discovery keeps each post to a single new file.
//
// This lives here rather than in index.ts because the queued blog PRs already
// edit index.ts. Rewriting that file would conflict with every one of them and
// strand their publish dates, which is the failure this change exists to fix.
// index.ts is now unused and is deleted once the queue drains.
const modules = import.meta.glob<Record<string, BlogPost>>(
  ["./*.ts", "!./index.ts", "!./registry.ts", "!./types.ts"],
  { eager: true }
);

// Newest first. Same-day posts fall back to slug so the order is stable across
// machines and builds.
export const posts: BlogPost[] = Object.values(modules)
  .flatMap((module) => Object.values(module))
  .sort(
    (a, b) =>
      b.dateISO.localeCompare(a.dateISO) || a.slug.localeCompare(b.slug)
  );

export const getPostBySlug = (slug: string): BlogPost | undefined => {
  return posts.find((p) => p.slug === slug);
};
