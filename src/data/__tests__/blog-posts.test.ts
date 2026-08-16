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
import { postDescription } from "@/lib/post-description";
import { renderMarkdownToHtml } from "../../../scripts/markdown-html.mjs";

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

// The constructs remark-gfm would add, and what to write instead. Hoisted out
// of the test below so the pairing check further down can run the same rules
// over sample markdown it also renders — the corpus proves no post trips a
// rule, which says nothing about whether the rule is aimed at the right thing.
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
    // ]( of a link target, the [ of a link whose text is its own URL, and the
    // < of an angle-bracket autolink.
    //
    // That last one is a correction. `<https://example.com/x>` is CommonMark,
    // not GFM: react-markdown renders it as a real <a> carrying the site's own
    // link classes, measured 2026-08-16 against scripts/markdown-html.mjs. The
    // pattern matches on the scheme, so before the `<` it also matched the URL
    // *inside* the brackets and reported "not rendered" about the one bare-ish
    // form that does render — uniformly, in every nesting path, since it is a
    // leaf-level match. Same shape as the `<code[\s>]` over-match retired in
    // #113: a scope pattern catching markup that ships correctly (PRA-1010).
    pattern: /(?<![([<])\bhttps?:\/\/[^\s)<>\]]+/g,
    use: "[descriptive text](the-url), or <the-url> to cite it bare",
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
  // GFM autolinks three literal forms. The rule above is named for all three
  // and caught one: the two below render as unclickable plain text, exactly
  // like the bare https:// URL it exists to catch, and matched nothing.
  {
    label: "bare www. URL",
    // The lookbehind carries `/`, `.` and a word character on top of the three
    // above, because `www.` is far more often a fragment of a link that is
    // already correct than a link that is not: the `https://www.host/path`
    // targets already in the corpus hit 230 times without them.
    pattern: /(?<![([<:/.@\w-])www\.[\w-]+\.[^\s)<>\]]+/g,
    // A `www.`-only destination is a relative href — it resolves against the
    // post's own path — so the scheme still has to be written out once the
    // text is a link.
    use: "[descriptive text](https://the-url)",
  },
  {
    label: "bare email address",
    // <hello@example.com> is CommonMark and renders as a real <a> with
    // href="mailto:hello@example.com", so this is the one form on the list
    // whose fix is punctuation rather than a rewrite. The lookbehind skips a
    // `:` so the mailto: of an explicit target does not read as the start of
    // an address, and requiring an alphabetic final label keeps a version pin
    // (react-markdown@10.0.0) from parsing as one.
    pattern: /(?<![([<:\w.+-])[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}\b/gi,
    use: "<hello@example.com>, which renders as a mailto: link",
  },
];

const unsupportedIn = (markdown: string) =>
  unsupported.flatMap(({ label, pattern, use, exempt }) =>
    Array.from(
      (exempt ? markdown.replace(exempt, "") : markdown).matchAll(pattern)
    ).map((match) => ({ label, use, text: match[0] }))
  );

// [text](destination). The destination is either <bracketed> or runs to the
// first whitespace or closing paren; stopping at whitespace drops the optional
// "title" that may follow it, which the older `[^)]*` swallowed into the path
// and then reported as a slashless link.
const INLINE_TARGET = /\]\([ \t]*(<[^<>\n]*>|[^\s()]*)/g;

// [ref]: destination, the other half of a [text][ref], [text][] or bare [text]
// link. Indented up to three spaces, because four makes it an indented code
// block that renders nothing, and the destination may sit on the next line.
//
// The negative lookahead skips a footnote definition ([^1]: Source.), which is
// shaped identically. See the test below for why that is safe rather than a
// hole (PRA-1010, PRA-1021).
const DEFINITION =
  /^[ \t]{0,3}\[(?!\^)[^\]\n]+\]:[ \t]*(?:\n[ \t]*)?(<[^<>\n]*>|\S+)[^\n]*/;

// Angle brackets around a destination are delimiters, not part of the href.
const destination = (raw: string) => raw.replace(/^<(.*)>$/, "$1");

// Every markdown form that can put a site-internal path in an href. There are
// two syntaxes, not one: the inline [text](/path/), and the link reference
// definition — [ref]: /path/ on its own line, paired elsewhere with
// [text][ref], [text][] or a bare [text]. Measured 2026-08-16 against
// scripts/markdown-html.mjs, every definition spelling emits a byte-identical
// href="/path", and until PRA-1021 this read only the inline one — so four of
// the five ways to write an internal link shipped the redirect unflagged.
const internalHrefs = (markdown: string) => {
  const body = stripCode(markdown);

  // A definition parses only at the start of a block. One folded into a
  // paragraph is lazy continuation — literal text that renders no anchor at
  // all — so each block contributes only its leading run of definition lines.
  const defined = body.split(/\n[ \t]*\n/).flatMap((block) => {
    const hrefs: string[] = [];

    for (let rest = block; ; ) {
      const match = DEFINITION.exec(rest);
      if (!match) return hrefs;

      hrefs.push(match[1]);
      rest = rest.slice(match[0].length).replace(/^\n/, "");
    }
  });

  return [...Array.from(body.matchAll(INLINE_TARGET), (m) => m[1]), ...defined]
    .map(destination)
    .filter((href) => href.startsWith("/"));
};

// Every pratik.pa.tel path 301s to its slash form, with one exception: a path
// whose last segment carries an extension is a file, not a directory index,
// and is served exactly as written.
const redirects = (href: string) => {
  const [path] = href.split(/[?#]/);
  const lastSegment = path.slice(path.lastIndexOf("/") + 1);
  return !path.endsWith("/") && !lastSegment.includes(".");
};

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
      internalHrefs(markdownSource(post.slug))
        .filter(redirects)
        .map((href) => `${post.slug}: ${href}`)
    );

    expect(offenders).toEqual([]);
  });

  // The corpus check above passes on every published post and banked draft,
  // and passed just as green while it could only see one of the two syntaxes
  // that emit an href. A rule about what the renderer emits can only be
  // checked against the renderer, so this asks both the same question and
  // requires one answer: a form is flagged if and only if the href it renders
  // would 301.
  //
  // Each row is written at the start of a block, which is where a link
  // reference definition parses. A definition-shaped line folded into a
  // paragraph is lazy continuation — literal text, no anchor — and is skipped
  // for that reason rather than flagged (PRA-1021).
  it("flags an internal link if and only if the href it renders redirects", () => {
    const forms = [
      "See [the post](/blog/foo) here.",
      "See [the post](/blog/foo/) here.",
      'See [the post](/blog/foo/ "Title") here.',
      "See [the post](</blog/foo>) here.",
      "See [the post](/og/foo.png) here.",
      "See [the post](https://example.com/x) here.",
      "See [the post][ref] here.\n\n[ref]: /blog/foo\n",
      "See [the post][ref] here.\n\n[ref]: /blog/foo/\n",
      "See [the post][] here.\n\n[the post]: /blog/foo\n",
      "See [the post] here.\n\n[the post]: /blog/foo\n",
      "- [the post][ref]\n\n[ref]: /blog/foo\n",
      'See [the post][ref] here.\n\n[ref]: /blog/foo "Title"\n',
      "See [the post][ref] here.\n\n[ref]: </blog/foo>\n",
      "See [the post][ref] here.\n\n   [ref]: /blog/foo\n",
      "See [the post][ref] here.\n\n    [ref]: /blog/foo\n",
      "See [the post][ref] here.\n\n[ref]:\n  /blog/foo\n",
      "See [the post][ref] here.\n\n[ref]: /og/foo.png\n",
      "See [the post][ref] here.\n\n[ref]: https://example.com/x\n",
      // Definitions stack, so a block's leading run is read to its end. The
      // slashless one here sits second, behind a correct one — reading only
      // the first definition per block passes this row for the wrong reason.
      "See [a][x] and [b][y].\n\n[x]: /blog/one/\n[y]: /blog/two\n",
      "See [a][x] and [b][y].\n\n[x]: /blog/one/\n[y]: /blog/two/\n",
      "See [a][x].\n\n[x]: /blog/one\nTrailing prose.\n",
      "Text here.\n[ref]: /blog/foo\n\nSee [the post][ref] there.\n",
      "See `[the post](/blog/foo)` here.",
      "```\n[ref]: /blog/foo\n```\n\nSee the post here.\n",
    ];

    const disagreements = forms.flatMap((markdown) => {
      // Only the site's own paths: `redirects` describes pratik.pa.tel's
      // routing, and an absolute URL to another host says nothing about it.
      const rendered = Array.from(
        renderMarkdownToHtml(markdown).matchAll(/href="(\/[^"]*)"/g),
        (match) => match[1]
      );
      const shipsARedirect = rendered.some(redirects);
      const flagged = internalHrefs(markdown).filter(redirects);

      return (flagged.length > 0) === shipsARedirect
        ? []
        : [
            `${JSON.stringify(markdown)} renders ${JSON.stringify(rendered)}` +
              (shipsARedirect
                ? " and nothing flags it"
                : ` but is flagged as ${JSON.stringify(flagged)}`),
          ];
    });

    expect(disagreements).toEqual([]);
  });

  // The scan skips a definition whose label opens with `^`, because a footnote
  // definition is shaped identically. That would be a hole if nothing else saw
  // the line: [^1]: /blog/foo does render href="/blog/foo". It is not silent —
  // the unsupported-markdown rule rejects the footnote outright, and the fix
  // it asks for is an inline link, which lands the path back under the gate.
  it("leaves a footnote definition's internal path to the footnote rule", () => {
    const labels = unsupportedIn("Claim.[^1]\n\n[^1]: /blog/foo\n").map(
      ({ label }) => label
    );

    expect(labels).toContain("footnote");
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
  //
  // "a bare URL renders unlinked" is three constructs, not one — GFM autolinks
  // https://, www. and bare email literals — and until 2026-08-16 this covered
  // the first and mistook one CommonMark form for it. See the rules above.
  it("writes post bodies in markdown the renderer supports", () => {
    const offenders = posts.flatMap((post) =>
      unsupportedIn(stripCode(markdownSource(post.slug))).map(
        ({ label, use, text }) =>
          `${post.slug}: ${label} is not rendered, use ${use} — ` +
          `"${text.replace(/\s+/g, " ").slice(0, 60)}"`
      )
    );

    expect(offenders).toEqual([]);
  });

  // The corpus check above passes on 24 published posts and every banked draft,
  // and passed just as green while the bare-URL rule was wrong in both
  // directions at once — rejecting <https://example.com/x>, which renders as a
  // real <a>, and ignoring www.example.com/x and hello@example.com, which do
  // not. A rule about what the renderer supports can only be checked against
  // the renderer, so this asks both the same question and requires one answer:
  // a form is flagged if and only if it ships without an anchor.
  //
  // Every link form CommonMark and GFM can express is listed, so a rule that
  // grows a new pattern has to say which side of the line the pattern is on
  // (PRA-1010).
  it("flags a link form if and only if it ships unlinked", () => {
    const forms = [
      "See https://example.com/x here.",
      "See www.example.com/x here.",
      "See hello@example.com here.",
      "See <https://example.com/x> here.",
      "See <hello@example.com> here.",
      "See [the docs](https://example.com/x) here.",
      "See [https://example.com/x](https://example.com/x) here.",
      "See [the docs][ref] here.\n\n[ref]: https://example.com/x\n",
      "Mail [us](mailto:hello@example.com) now.",
      "See [the docs](https://www.example.com/x) here.",
    ];

    for (const markdown of forms) {
      const linked = /<a /.test(renderMarkdownToHtml(markdown));
      const flagged = unsupportedIn(markdown).map(({ label }) => label);

      expect(
        flagged.length > 0,
        linked
          ? `${JSON.stringify(markdown)} renders as a link but is flagged as ` +
            `${flagged.join(", ")}`
          : `${JSON.stringify(markdown)} ships unlinked and nothing flags it`
      ).toBe(!linked);
    }
  });

  // CommonMark folds adjacent lines into one paragraph. Two lines that each
  // open with a bold run are two things the author wrote as separate lines —
  // a definition pair, a term list — and the fold silently joins them into a
  // run-on sentence. Nothing else catches it: the body is present, so the
  // prerenderer's paragraph-count gate passes, the markup is valid, and
  // contrast and axe have nothing to say about a paragraph that reads wrong.
  //
  // Found 2026-08-13 in the section titled "The Multiplier Framework", whose
  // whole point is contrasting two named quantities. Measured in chromium at
  // 1280px: both <strong> labels reported an identical getBoundingClientRect()
  // top of 2743 — the same visual line. At 393px they separated only by
  // accidental wrap, not by structure.
  //
  // The fix is a blank line. `br` is not in the renderer's tag map, so a
  // two-trailing-space hard break renders as nothing and is not a workaround.
  it("does not fold a post's stacked bold lines into one paragraph", () => {
    const offenders = posts.flatMap((post) => {
      const lines = stripCode(markdownSource(post.slug)).split("\n");
      return lines.flatMap((line, i) =>
        line.startsWith("**") && lines[i + 1]?.startsWith("**")
          ? [
              `${post.slug}: two bold lines with no blank line between them ` +
                `render as one paragraph — "${line.slice(0, 40)}" then ` +
                `"${lines[i + 1].slice(0, 40)}"`,
            ]
          : []
      );
    });

    expect(offenders).toEqual([]);
  });

  // `subtitle` renders directly under the title, so it is allowed to be a
  // fragment ("And How It Can Save Your Sanity"). The same string used to be
  // the only description the meta tags, the JSON-LD and the RSS feed had — and
  // there it appears with no title beside it, where a fragment reads as broken
  // copy and Google throws it out to synthesise its own snippet. `description`
  // is the override for those posts; this is the tripwire that says a post
  // needs one.
  //
  // 50 is a tripwire, not a quality bar. The three posts this rule was written
  // for measured 28, 31 and 34 characters; the thinnest subtitle that stands
  // alone measures 58. The floor sits in that gap deliberately, so it fires on
  // a detached fragment without forcing churn on short, complete sentences.
  it("gives every post a description that stands on its own", () => {
    const offenders = posts
      .map((post) => ({ post, description: postDescription(post) }))
      .filter(({ description }) => description.length < 50)
      .map(
        ({ post, description }) =>
          `${post.slug}: ${description.length}ch — "${description}". ` +
          `Add a \`description\` to src/data/blog-posts/${post.slug}.ts.`
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

  /**
   * Two posts shared `2026-06-02` while `2026-06-09` sat empty, and nothing
   * anywhere said so.
   *
   * The registry's `|| a.slug.localeCompare(b.slug)` tiebreak is what hid it:
   * a collision still sorts, deterministically, so the archive looked fine
   * while presenting the older post as the newer one on the strength of
   * "a" < "t". Every date surface then published the wrong value in agreement
   * — `sitemap.xml` `<lastmod>`, `rss.xml` `<pubDate>`, and each post's JSON-LD
   * `datePublished` and `article:published_time`. Agreement across four
   * surfaces reads as corroboration; here it only meant one bad field with
   * four readers.
   *
   * So this asserts the thing the tiebreak makes invisible. The tiebreak itself
   * stays — it is the right answer for a genuine same-day pair, and this test is
   * what turns such a pair into a deliberate choice rather than an accident
   * nobody can see.
   */
  it("no two posts share a dateISO", () => {
    const slugsByDate = new Map<string, string[]>();
    for (const post of posts) {
      slugsByDate.set(post.dateISO, [
        ...(slugsByDate.get(post.dateISO) ?? []),
        post.slug,
      ]);
    }

    const collisions = [...slugsByDate.entries()]
      .filter(([, slugs]) => slugs.length > 1)
      .map(([dateISO, slugs]) => `${dateISO}: ${[...slugs].sort().join(", ")}`)
      .sort();

    expect(
      collisions,
      "posts sharing a publish date order by slug, so the archive, the newer/older " +
        "nav, the sitemap, the feed and the JSON-LD all present an arbitrary one " +
        "as the newer post"
    ).toEqual([]);
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
