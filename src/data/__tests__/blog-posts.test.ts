import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  posts,
  getPostBySlug,
  getAdjacentPosts,
  loadPostContent,
} from "../blog-posts/registry";
import type { BlogPost } from "../blog-posts/registry";

// The copy rules below lint what an author wrote, so they read the markdown off
// disk. loadPostContent returns the built HTML, where a markdown link is an
// <a> and the source patterns match nothing — the guards would pass on every
// input instead of failing on a bad one.
const markdownSource = (slug: string) =>
  readFileSync(
    join(process.cwd(), "src", "data", "blog-posts", "content", `${slug}.md`),
    "utf-8"
  );

// A fenced block or an inline code span is a sample of someone else's syntax,
// not copy the renderer is meant to interpret, so every copy rule below reads
// the body with both removed.
const stripCode = (markdown: string) =>
  markdown.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");

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
    }
  });

  // The body lives in content/<slug>.md and is fetched on demand, so a post
  // whose file is missing or misnamed still renders a title, a hero and an
  // empty article. This is the check that turns that into a failure.
  it("each post has a body file that loads", async () => {
    for (const post of posts) {
      const content = await loadPostContent(post.slug);
      expect(content.trim(), `${post.slug} has an empty body`).toBeTruthy();
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
      Array.from(markdownSource(post.slug).matchAll(/\]\((\/[^)]*)\)/g))
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

  // Brand v1.9 §The `$` Character, a hard stop the board mandated in PRA-640
  // after a shell variable in a post read as a ticker to someone scrolling
  // past. A dollar sign in published copy is only ever a price, so it passes
  // only when stuck directly to a digit ($9, $1.25, $295M). Everything else
  // fails: a bare $, a shell variable named in a sentence, "$ 40" with a
  // space, and the lookalikes ＄ and ﹩. The social gate has enforced this
  // since 2026-07-21 but never saw blog copy, which is the hole this closes.
  //
  // Fenced blocks and inline code spans are exempt: $PATH inside a shell
  // sample is correct, and stripping it would make the sample wrong.
  it("uses $ in post copy only as a price", () => {
    const offenders = posts.flatMap((post) =>
      [
        post.title,
        post.subtitle,
        ...post.tags,
        stripCode(markdownSource(post.slug)),
      ].flatMap(
        (text) =>
          Array.from(text.matchAll(/[$＄﹩](?!\d)/g)).map(
            (match) =>
              `${post.slug}: ...${text
                .slice(Math.max(0, match.index - 30), match.index + 30)
                .replace(/\s+/g, " ")}...`
          )
      )
    );

    expect(offenders).toEqual([]);
  });

  // scripts/markdown-html.mjs runs react-markdown with no remark-gfm, so the
  // body is CommonMark only. The GFM-only constructs below do not fail to
  // build, they parse as something else and ship: a pipe table emits its own
  // source as one paragraph of raw text, ~~x~~ and - [ ] keep their literal
  // punctuation, and a bare URL renders unlinked. The worst is the footnote,
  // because it renders as an anchor rather than as text — Claim.[^1] plus a
  // [^1]: Source. definition emits <a href="Source.">^1</a>, a live link whose
  // href is the citation prose. Nothing else catches these: the body is
  // present, so the prerenderer's paragraph-count gate passes, and the href
  // is not an internal path, so the trailing-slash rule above never sees it.
  //
  // Found 2026-08-05 when a draft was written with two markdown tables. No
  // published post had ever used one, which is why the hole stayed open. The
  // fix is a lint rather than remark-gfm because turning GFM on would need
  // table, thead and td styling the design system does not define yet.
  it("writes post bodies in markdown the renderer supports", () => {
    const unsupported = [
      {
        label: "table",
        pattern: /^[ \t]*\|.*\|[ \t]*$/gm,
        use: "a `- **Lead-in** — explanation` bullet list",
      },
      {
        label: "strikethrough",
        pattern: /~~[^~\n]+~~/g,
        use: "plain wording, or <del> if the strike is the point",
      },
      {
        label: "footnote",
        pattern: /\[\^[^\]\n]+\]/g,
        use: "an inline [markdown link](https://example.com/) to the source",
      },
      {
        label: "task list",
        pattern: /^[ \t]*[-*][ \t]+\[[ xX]\][ \t]+/gm,
        use: "a plain bullet list",
      },
      {
        label: "bare URL",
        // Autolinking is GFM-only, so a URL that is not already the target of
        // a markdown link ships as unclickable text. The lookbehind skips the
        // ]( of a link target and the [ of a link whose text is its own URL.
        pattern: /(?<![([])\bhttps?:\/\/[^\s)<>\]]+/g,
        use: "[descriptive text](the-url)",
        // A link reference definition — [ref]: https://example.com/ on its own
        // line, paired with a [text][ref] elsewhere — is CommonMark, not GFM,
        // and react-markdown renders it as a real <a>. Its URL is a link
        // target rather than a bare one, so this rule has to skip the whole
        // definition line or it rejects markdown that ships correctly.
        //
        // The exemption is scoped to this rule alone. A footnote definition
        // ([^1]: Source.) is also shaped like a link reference definition, so
        // stripping these for every rule would blind the footnote rule above
        // to the half of the construct that supplies the bad href.
        exempt: /^[ \t]*\[[^\]\n]+\]:[ \t]*\S+.*$/gm,
      },
    ];

    const offenders = posts.flatMap((post) => {
      const body = stripCode(markdownSource(post.slug));
      return unsupported.flatMap(({ label, pattern, use, exempt }) =>
        Array.from(
          (exempt ? body.replace(exempt, "") : body).matchAll(pattern)
        ).map(
          (match) =>
            `${post.slug}: ${label} is not rendered, use ${use} — ` +
            `"${match[0].replace(/\s+/g, " ").slice(0, 60)}"`
        )
      );
    });

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

  // index.ts was the retired hand-written list, now deleted. Re-importing a
  // barrel from the blog-posts directory would silently drop any post whose
  // author did not also edit it, so this guards against it ever coming back.
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
