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

// Bodies live beside the metadata as markdown and are fetched per post. They
// used to be template literals on the post objects, which put all 21 articles
// (~53KB brotli) into the chunk every route loads to render five titles on the
// homepage. This glob is deliberately not eager: only the post on screen is
// downloaded.
const contents = import.meta.glob<string>("./content/*.md", {
  query: "?raw",
  import: "default",
});

export const loadPostContent = (slug: string): Promise<string> => {
  const load = contents[`./content/${slug}.md`];
  if (!load) return Promise.reject(new Error(`No content for post: ${slug}`));
  return load();
};

// Neighbours of a post in the published order, for the links at the end of a
// post. The list is newest first, so the entry before a post is the newer one.
// The list is passed in rather than read from the module so the caller decides
// which ordering is on screen.
export const getAdjacentPosts = (
  list: BlogPost[],
  slug: string
): { newer?: BlogPost; older?: BlogPost } => {
  const i = list.findIndex((p) => p.slug === slug);
  if (i === -1) return {};
  return { newer: list[i - 1], older: list[i + 1] };
};
