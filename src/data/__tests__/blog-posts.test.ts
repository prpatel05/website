import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { posts, getPostBySlug, getAdjacentPosts } from "../blog-posts/registry";
import type { BlogPost } from "../blog-posts/registry";

describe("blog-posts data", () => {
  it("exports a non-empty posts array", () => {
    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
  });

  it("each post has required fields", () => {
    for (const post of posts) {
      expect(post.slug).toBeTruthy();
      expect(post.title).toBeTruthy();
      expect(post.subtitle).toBeTruthy();
      expect(post.date).toBeTruthy();
      expect(post.dateISO).toBeTruthy();
      expect(post.readTime).toBeTruthy();
      expect(Array.isArray(post.tags)).toBe(true);
      expect(post.tags.length).toBeGreaterThan(0);
      expect(post.image).toBeTruthy();
      expect(post.content).toBeTruthy();
    }
  });

  it("each post has a unique slug", () => {
    const slugs = posts.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("each post has a unique image path", () => {
    const images = posts.map((p) => p.image);
    expect(new Set(images).size).toBe(images.length);
  });

  // Post bodies are the one place internal links are hand-written rather than
  // built from a slug, so they are where the trailing-slash convention drifts
  // back. Every pratik.pa.tel path 301s to its slash form, and a markdown link
  // renders as a plain anchor, so a slashless one sends readers and crawlers
  // through a redirect that the rest of the site no longer emits.
  it("writes internal links in a post body in their non-redirecting form", () => {
    const offenders = posts.flatMap((post) =>
      Array.from(post.content.matchAll(/\]\((\/[^)]*)\)/g))
        .map((match) => match[1])
        // A path whose last segment carries an extension is a file, not a
        // directory index, and is served without a redirect.
        .filter((href) => {
          const [path] = href.split(/[?#]/);
          const lastSegment = path.slice(path.lastIndexOf("/") + 1);
          return !path.endsWith("/") && !lastSegment.includes(".");
        })
        .map((href) => `${post.slug}: ${href}`)
    );

    expect(offenders).toEqual([]);
  });

  // Guards the discovery contract: dropping a .ts file into the directory must
  // publish it, with no shared index to edit. Filenames need not match slugs.
  it("discovers every post file in the directory", () => {
    const postsDir = join(process.cwd(), "src", "data", "blog-posts");
    const discovered = readdirSync(postsDir)
      .filter(
        (name) =>
          name.endsWith(".ts") &&
          name !== "index.ts" &&
          name !== "registry.ts" &&
          name !== "types.ts"
      )
      .map((name) => {
        const source = readFileSync(join(postsDir, name), "utf-8");
        const slug = /slug:\s*"([^"]+)"/.exec(source)?.[1];
        expect(slug, `${name} has no slug`).toBeTruthy();
        return slug as string;
      })
      .sort();

    expect(posts.map((p) => p.slug).sort()).toEqual(discovered);
  });

  // index.ts is the retired hand-written list. It is left on disk untouched so
  // the queued blog PRs that edit it still merge cleanly; importing it again
  // would silently drop any post whose author did not also edit it.
  it("no source file imports the retired index", () => {
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.tsx?$/.test(entry.name)) {
          if (/["']@\/data\/blog-posts["']/.test(readFileSync(full, "utf-8"))) {
            offenders.push(full);
          }
        }
      }
    };

    walk(join(process.cwd(), "src"));
    expect(offenders).toEqual([]);
  });

  it("orders posts newest first, breaking ties by slug", () => {
    const expected = [...posts].sort(
      (a, b) =>
        b.dateISO.localeCompare(a.dateISO) || a.slug.localeCompare(b.slug)
    );

    expect(posts.map((p) => p.slug)).toEqual(expected.map((p) => p.slug));
  });

  it("each local blog image asset has unique file contents", () => {
    const seenHashes = new Map<string, string>();

    for (const post of posts) {
      if (!post.image.startsWith("/")) {
        continue;
      }

      const assetPath = join(process.cwd(), "public", post.image.slice(1));
      expect(
        existsSync(assetPath),
        `${post.slug} points to a missing image asset: ${post.image}`
      ).toBe(true);

      const hash = createHash("sha256")
        .update(readFileSync(assetPath))
        .digest("hex");
      const duplicateSlug = seenHashes.get(hash);

      expect(
        duplicateSlug,
        `${post.slug} reuses the same image file contents as ${duplicateSlug}`
      ).toBeUndefined();

      seenHashes.set(hash, post.slug);
    }
  });

  it("dateISO is a valid ISO date string", () => {
    for (const post of posts) {
      const parsed = new Date(post.dateISO);
      expect(parsed.toString()).not.toBe("Invalid Date");
    }
  });
});

describe("getPostBySlug", () => {
  it("returns the matching post for a known slug", () => {
    const first = posts[0];
    const result = getPostBySlug(first.slug);
    expect(result).toBeDefined();
    expect(result!.slug).toBe(first.slug);
    expect(result!.title).toBe(first.title);
  });

  it("returns undefined for an unknown slug", () => {
    expect(getPostBySlug("this-slug-does-not-exist")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(getPostBySlug("")).toBeUndefined();
  });

  it("finds each post by its slug", () => {
    for (const post of posts) {
      const found = getPostBySlug(post.slug);
      expect(found).toBeDefined();
      expect(found!.title).toBe(post.title);
    }
  });
});

describe("getAdjacentPosts", () => {
  // Newest first, matching the order registry.ts exports.
  const stub = (slug: string) => ({ slug }) as BlogPost;
  const list = [stub("newest"), stub("middle"), stub("oldest")];

  it("gives the newest post no newer neighbour", () => {
    const { newer, older } = getAdjacentPosts(list, "newest");
    expect(newer).toBeUndefined();
    expect(older!.slug).toBe("middle");
  });

  it("gives the oldest post no older neighbour", () => {
    const { newer, older } = getAdjacentPosts(list, "oldest");
    expect(newer!.slug).toBe("middle");
    expect(older).toBeUndefined();
  });

  it("gives a middle post both neighbours", () => {
    const { newer, older } = getAdjacentPosts(list, "middle");
    expect(newer!.slug).toBe("newest");
    expect(older!.slug).toBe("oldest");
  });

  it("returns no neighbours for a slug that is not in the list", () => {
    expect(getAdjacentPosts(list, "not-a-post")).toEqual({});
  });

  it("returns no neighbours when the list holds a single post", () => {
    expect(getAdjacentPosts([stub("only")], "only")).toEqual({});
  });

  it("walks the real post list end to end without a gap", () => {
    for (const [i, post] of posts.entries()) {
      const { newer, older } = getAdjacentPosts(posts, post.slug);
      expect(newer?.slug).toBe(posts[i - 1]?.slug);
      expect(older?.slug).toBe(posts[i + 1]?.slug);
    }
  });
});
