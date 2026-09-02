import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { fromMarkdown } from "mdast-util-from-markdown";
import rehypeRaw from "rehype-raw";
import type { Heading, Nodes, Paragraph } from "mdast";
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

// A code sample is someone else's syntax, not copy the renderer is meant to
// interpret, so every copy rule below reads the body with code removed.
//
// "A fenced block or an inline code span" was this comment's own scope until
// PRA-1033, and that is two of CommonMark's forms rather than all of them.
// react-markdown paints the rest as <pre><code> just the same: a `~~~` fence,
// a 4-space or tab-indented block, a fence left unterminated, a
// ``double-backtick`` span, and a span that pairs across a line break. Each one
// the helper missed was read as prose by all five rules below at once.
//
// So this asks the renderer's own parser for the ranges rather than matching
// the forms. Enumerating them is what was wrong before, and the enumeration
// cannot be finished by hand anyway: an indented block nests relative to its
// container, so a fence in a blockquote and a sample under a list item need the
// block structure that mdast-util-from-markdown — the parser remark-parse runs
// underneath react-markdown — has already worked out.
//
// Each range is blanked rather than deleted, so every offset and line number a
// rule below reads still lines up with the source the author wrote.
const blank = (source: string) => source.replace(/[^\n]/g, " ");

const stripCode = (markdown: string) => {
  const ranges: [number, number][] = [];

  const walk = (node: Nodes) => {
    if (node.type === "code" || node.type === "inlineCode") {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;

      if (start !== undefined && end !== undefined) ranges.push([start, end]);
      return;
    }

    if ("children" in node) node.children.forEach(walk);
  };

  walk(fromMarkdown(markdown));

  // Blanking preserves length, so an earlier edit never shifts a later range.
  return ranges.reduce(
    (body, [start, end]) =>
      body.slice(0, start) + blank(body.slice(start, end)) + body.slice(end),
    markdown
  );
};

// scripts/markdown-html.mjs runs react-markdown with no rehype-raw, so a tag
// the author wrote is neither rendered nor dropped: it is escaped and painted
// as visible angle brackets. `The price was <del>40</del> 20.` ships
// `&lt;del&gt;40&lt;/del&gt;` — measured. PRA-1072 removed the advice that
// pointed authors at a raw tag and gated the advice against the renderer; this
// is the body side it scoped out, which had no gate at all.
//
// The rule reads the parser rather than matching the form, and that is the
// whole difficulty of this one. An angle bracket is not evidence of anything:
// `<https://example.com/x>` and `<hello@example.com>` are CommonMark autolinks
// that render as real anchors, and the second is what the bare-email row's own
// advice tells the author to write — so a rule that rejects a bracket
// contradicts the advice one screen up, which is the over-match PRA-1010
// retired. The tag production the PRA-1072 advice gate uses is no help here
// either: `/<\/?[A-Za-z][^<>]*>/` matches both autolinks, because `https` and
// `hello` are legal tag names.
//
// CommonMark already draws the line exactly, and the parser is where it is
// drawn: an autolink is a `link` node, a tag is an `html` node. That also picks
// up what no tag pattern can — an HTML comment has no tag name, so `[A-Za-z]`
// misses `<!-- note -->` outright, and it escapes to visible text just as a tag
// does (measured) — and it exempts a sample for free, since a tag inside a
// fence or a span is part of a `code` node and never an `html` one. Same move,
// and for the same reason, as PRA-1033 asking the parser for code ranges
// instead of enumerating the forms.
const rawHtml = (markdown: string) => {
  const found: string[] = [];

  const walk = (node: Nodes) => {
    if (node.type === "html") {
      found.push(node.value);
      return;
    }

    if ("children" in node) node.children.forEach(walk);
  };

  walk(fromMarkdown(markdown));
  return found;
};

// Raw HTML is reported alongside the rules below rather than as one of them: it
// is not a construct remark-gfm would add, and it is not found by a pattern. It
// belongs in the same failure because it fails in the same way — the author
// wrote markup and the reader is shown its source.
const RAW_HTML = {
  label: "raw HTML",
  // Every other row names a different syntax for the same thing. This one
  // cannot: what to write instead depends on the tag, and for a tag with no
  // markdown spelling the honest answer is the one the strikethrough row
  // already gives — rewrite the sentence. No angle bracket is spelled here, so
  // the advice gate below passes it trivially, which is the point: advice for
  // avoiding raw HTML should not contain any.
  use: "the markdown for it (`**bold**`, `*italic*`, `` `code` ``, `[text](url)`), or plain wording where markdown has no spelling for one",
};

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
    // A strike has no CommonMark spelling, so unlike every other row here the
    // fix is a rewrite rather than a different syntax — the sentence has to
    // carry the meaning. Naming a raw tag was the one false claim on this list:
    // it is escaped to visible angle brackets, not rendered (PRA-1072). Getting
    // a real strike is a renderer change — rehype-raw, or a `del` entry in
    // `components` — and belongs in a filed issue rather than in advice here.
    //
    // The clause is joined with a semicolon rather than a dash because the
    // failure message already spends one on `use ${use} — "${text}"`, and a
    // second dash inside the advice leaves the reader guessing which one
    // separates the advice from the offending text.
    use: "plain wording; raw HTML is escaped to literal angle brackets, so a strike has no spelling this renderer accepts",
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
    // The scheme is spelled inside the brackets because the scheme is what
    // makes an autolink one: `<the-url>` read literally is a tag name, and
    // escapes exactly as `<del>` did. It resolved correctly in practice — this
    // rule matches on a scheme, so the author substituting always had one — but
    // advice that is true only after substitution cannot be measured against
    // the renderer, and this row sits next to the one that was false (PRA-1072).
    use: "[descriptive text](the-url), or <https://the-url> to cite it bare",
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

const unsupportedIn = (markdown: string) => [
  ...unsupported.flatMap(({ label, pattern, use, exempt }) =>
    Array.from(
      (exempt ? markdown.replace(exempt, "") : markdown).matchAll(pattern)
    ).map((match) => ({ label, use, text: match[0] }))
  ),
  ...rawHtml(markdown).map((text) => ({ ...RAW_HTML, text })),
];

// [text](destination). The destination is either <bracketed> or runs to the
// first whitespace or closing paren; stopping at whitespace drops the optional
// "title" that may follow it, which the older `[^)]*` swallowed into the path
// and then reported as a slashless link.
const INLINE_TARGET = /\]\([ \t]*(<[^<>\n]*>|[^\s()]*)/g;

// [ref]: destination, the other half of a [text][ref], [text][] or bare [text]
// link. Indented up to three spaces, because four makes it an indented code
// block that renders nothing, and the destination may sit on the next line.
//
// That bound no longer decides anything: since PRA-1033 stripCode blanks the
// indented block before this pattern sees the line, and relaxing {0,3} to *
// leaves the whole table below green. It stays because it states CommonMark's
// rule where the pattern is read — but it was never the whole rule on its own.
// [ \t] counts a tab as one character and a tab is four columns, so a
// tab-indented definition cleared the bound and was flagged as shipping a
// redirect while rendering no anchor at all. stripCode is what closes that.
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

// CommonMark folds a block's source lines into one flow, so what the reader
// meets is a *rendered* line, not a source line. This walks a block's inline
// content in order and returns one entry per rendered line: the source line of
// the bold run that opens it, `false` if anything else opens it, and `null`
// where a hard break puts a line ending the reader actually sees.
//
// Reading the parser rather than the source column is the whole point. A bold
// run is a `strong` node however it was spelled and wherever it sits, so
// `__bold__`, a line indented one to three spaces, a line inside a blockquote
// or a list item, and a line whose bold sits behind a code chip are all the
// same node — and each of those was invisible to a `line.startsWith("**")`
// test that read column 0 (PRA-1052).
const boldLeads = (block: Paragraph | Heading) => {
  const lines: (number | false | null)[] = [];
  let line: { copy: boolean; bold: number | false } = {
    copy: false,
    bold: false,
  };

  const endLine = (visible: boolean) => {
    lines.push(line.bold);
    if (visible) lines.push(null);
    line = { copy: false, bold: false };
  };

  const walk = (node: Nodes) => {
    switch (node.type) {
      // A soft line break lives inside a text node's value rather than in a
      // node of its own, and it is the only thing that starts a rendered line.
      case "text":
        node.value.split("\n").forEach((part, i) => {
          if (i > 0) endLine(false);
          if (part.trim()) line.copy = true;
        });
        return;
      // A hard break does render. `components` in scripts/markdown-html.mjs
      // names no `br`, but react-markdown falls through to the default element
      // for every tag it does not name, so `**One.**  \n**Two.**` emits
      // `<strong>One.</strong><br/>` — measured 2026-08-16. The two lines are
      // therefore two lines, and this is not the fold.
      case "break":
        endLine(true);
        return;
      // Code is not copy — the same rule every gate in this file reads its
      // bodies through. A span's own newlines render as spaces (`` `a\nb` ``
      // ships `<code>a b</code>`), so it starts no rendered line either.
      case "inlineCode":
        return;
      case "strong":
        if (!line.copy) line.bold = node.position!.start.line;
        line.copy = true;
        // A bold run can hold a soft break of its own, and the line that break
        // opens sits *inside* the bold rather than being led by it.
        node.children.forEach(walk);
        return;
      default:
        // A link or an emphasis is a wrapper: `[**One.**](/a/)` still opens its
        // line with a bold run. An image or a raw HTML span is not — it paints
        // something of its own ahead of the bold.
        if ("children" in node) node.children.forEach(walk);
        else line.copy = true;
    }
  };

  block.children.forEach(walk);
  endLine(false);
  return lines;
};

// Two rendered lines in one block that each open with a bold run: the pair an
// author wrote as two lines, folded into one run-on. Reported as the source
// lines of the two bold runs.
//
// A heading is scanned alongside a paragraph because a setext heading is
// written over as many lines as the author likes and folds them the same way.
const stackedBoldLeads = (markdown: string) => {
  const offenders: [number, number][] = [];

  const walk = (node: Nodes) => {
    if (node.type === "paragraph" || node.type === "heading") {
      const lines = boldLeads(node);

      lines.forEach((bold, i) => {
        const next = lines[i + 1];
        if (bold && next) offenders.push([bold, next]);
      });
      return;
    }

    if ("children" in node) node.children.forEach(walk);
  };

  walk(fromMarkdown(markdown));
  return offenders;
};

// The same question asked of the rendered HTML, so the pairing test below can
// require one answer from both. A NUL cannot occur in the markup, so it is
// safe as the "a bold run starts here" mark.
const BOLD_LEAD = "\u0000";

const rendersStackedBold = (html: string) =>
  html
    // Every tag that is not inline copy ends the run the browser lays out
    // continuously: a `p`, an `li`'s span and an `h2` are separate flows, and
    // `br` is the one line ending it honours. A line break left inside a run is
    // one the reader never sees as a break.
    .split(/<\/?(?!(?:strong|em|a|code)\b)[a-z][^>]*>/i)
    .some((flow) =>
      flow
        .replace(/<code\b[^>]*>[\s\S]*?<\/code>/g, "")
        .replace(/<strong\b[^>]*>/g, BOLD_LEAD)
        .replace(/<[^>]*>/g, "")
        .split("\n")
        .map((rendered) => rendered.trimStart().startsWith(BOLD_LEAD))
        .some((bold, i, all) => bold && all[i + 1])
    );

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

  // stripCode is the exemption all five copy rules read the body through, so a
  // form it does not recognise is not one false positive but five. The same
  // sample, written as a 4-space indented block, trips the `$` rule with
  // `export $PATH=/usr/bin`, the unsupported-markdown rule with a pipe table
  // row, the bare-URL rule inside it, the stacked-bold rule with two lines
  // opening `**`, and the trailing-slash rule with `[t](/blog/foo)` — five
  // simultaneous failures, on markdown that is correct. The cheapest way to
  // make a red gate green is to reshape the sample until it passes, so the cost
  // lands on whoever is writing, silently, and never appears as a bug.
  //
  // The corpus cannot catch that: a sweep of `origin/main` plus all 28 banked
  // blog branches — 41 post bodies — finds none of these forms, so the gates
  // have been green through every hole listed below. This asks the renderer
  // instead, in the shape PRA-1010 and PRA-1021 established.
  //
  // The question is "does this reach the reader as prose", not "is it inside
  // <code>", because those differ in one direction that matters: a fence's info
  // string (```js) renders nowhere at all, and removing it is right for the
  // same reason removing the block is (PRA-1033).
  it("strips a sample if and only if the renderer does not paint it as prose", () => {
    const forms = [
      // The two forms the helper was named for, plus the plain paragraph that
      // must survive — a row reading "ok" is only evidence if something in the
      // table is required to come out the other side.
      "```\nPAYLOAD\n```\n",
      "```js\nPAYLOAD\n```\n",
      "See `PAYLOAD` here.\n",
      "See PAYLOAD here.\n",
      // Fences the two-form helper also happened to catch. The last one is the
      // info string: it renders nowhere, so "stripped" is the right answer for
      // it and "inside <code>" would have been the wrong question.
      "````\nPAYLOAD\n````\n",
      "  ```\n  PAYLOAD\n  ```\n",
      "- item\n\n  ```\n  PAYLOAD\n  ```\n",
      "> ```\n> PAYLOAD\n> ```\n",
      "```PAYLOAD\nbody\n```\n",
      // Code to the renderer, prose to the two-form helper. The first six are
      // PRA-1033 as filed; the three after them turned up rendering the table.
      // A code span pairs across a line break, which is why the mirror-hole
      // argument for the old `[^`\n]*` — "renderer and helper agree within a
      // line" — held only within a line. The last two are container blocks: an
      // indented block nests relative to its parent, so no amount of pattern
      // gets them without the block structure the parser already has.
      "Prose.\n\n    PAYLOAD\n",
      "Prose.\n\n\tPAYLOAD\n",
      "~~~\nPAYLOAD\n~~~\n",
      "~~~js\nPAYLOAD\n~~~\n",
      "See ``PAYLOAD`` here.\n",
      "```\nPAYLOAD\n",
      "See `foo\nPAYLOAD` here.\n",
      "- item\n\n      PAYLOAD\n",
      "> Prose.\n>\n>     PAYLOAD\n",
      // Prose that must survive, each a near-miss of a row above: an indented
      // block cannot interrupt a paragraph or a list item's own continuation,
      // an unpaired backtick opens nothing, `~~` and `~~~` inline are literal
      // punctuation rather than a fence — the strikethrough rule above still
      // needs to see them — and a raw HTML block ships as escaped text.
      "Prose line.\n    PAYLOAD\n",
      "- item\n\n    PAYLOAD\n",
      "A ` char and PAYLOAD here.\n",
      "See ~~PAYLOAD~~ here.\n",
      "See ~~~PAYLOAD~~~ here.\n",
      "<div>\nPAYLOAD\n</div>\n",
    ];

    const disagreements = forms.flatMap((markdown) => {
      // <code> cannot nest, so removing each element's contents leaves exactly
      // what the reader is given as copy.
      const prose = renderMarkdownToHtml(markdown).replace(
        /<code[^>]*>[\s\S]*?<\/code>/g,
        ""
      );
      const readAsProse = prose.includes("PAYLOAD");
      const stripped = !stripCode(markdown).includes("PAYLOAD");

      return stripped === !readAsProse
        ? []
        : [
            `${JSON.stringify(markdown)} ` +
              (readAsProse
                ? "renders as prose but stripCode removes it"
                : "renders as code but stripCode leaves it for the copy rules"),
          ];
    });

    expect(disagreements).toEqual([]);
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
      // An indented code block is the other way to write a sample, and both
      // halves of this rule were blind to it until PRA-1033: the inline link
      // was flagged though the renderer paints it inside <code>, and a
      // tab-indented definition slipped under the `{0,3}` bound above as a
      // definition when a tab is four columns and makes the line code.
      "Prose.\n\n    See [the post](/blog/foo) here.\n",
      "See [the post][ref] here.\n\n\t[ref]: /blog/foo\n",
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
  //
  // Raw HTML is reported here too, and it is the one thing on the list that GFM
  // would not fix: the missing plugin is rehype-raw, not remark-gfm. It belongs
  // in this failure because the author meets it the same way — markup written,
  // source shipped — and because it is what the strikethrough row used to
  // advise (PRA-1072). Measured across 24 published bodies and 346 on banked
  // blog/* branches, 280 of the 370 carrying a `**` as a positive control: no
  // body trips it today, so the cost lands on the first author to reach for a
  // tag rather than on anything already written.
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

  // Every `use:` string above is a claim about the renderer, and the rules have
  // been measured against it while the advice never was. The strike row's claim
  // was false: react-markdown runs with no rehype-raw, so a raw tag is neither
  // rendered nor dropped — it is escaped and painted as visible angle brackets.
  // `The price was <del>40</del> 20.` ships `&lt;del&gt;40&lt;/del&gt;`, so an
  // author who hit the strikethrough lint and did what it said put literal
  // angle brackets on the page, in the one sentence where the strike was the
  // point. Nothing fired: every rule here is aimed at the GFM constructs, not
  // at the advice for avoiding them (PRA-1072).
  //
  // The angle bracket is the whole ambiguity, and the file already disagreed
  // with itself about it — the stripCode table above uses `<div>` as a case
  // built on raw HTML shipping escaped, one screen from advice that assumed the
  // opposite. `<https://…>` and `<hello@example.com>` are CommonMark autolinks
  // that render as real anchors (PRA-1010); `<del>` matches the raw HTML tag
  // production and escapes. The two are indistinguishable by eye in a failure
  // message, which is why this asks the renderer rather than a reader.
  //
  // Spelling the scheme inside the brackets is what makes the bare-URL row
  // answerable at all. `<the-url>` is a placeholder that resolves correctly
  // only because that rule matches on a scheme the author therefore already
  // has — but read literally it is a tag name, so it escapes, and advice that
  // is true only after substitution cannot be checked. `<https://the-url>`
  // renders as an anchor as written, and says the part that carries the
  // meaning: an autolink is a scheme in brackets, not brackets.
  //
  // The pattern is a tag production — a name, then anything up to the close —
  // rather than "brackets around no whitespace", because an attribute carries
  // a space and that spelling let every tag with one straight through. That is
  // not hypothetical: `<del>` is now ruled out by name in the advice above, so
  // the next reach for a strike is the tag that does it with CSS, and
  // `<span style="text-decoration:line-through">` escapes exactly as `<del>`
  // did — measured. Requiring a leading letter is what keeps the looser bound
  // honest: it matches a tag, and not a `<` used as prose punctuation.
  it("gives advice that spells no angle-bracket form the renderer escapes", () => {
    const escaped = [...unsupported, RAW_HTML].flatMap(({ label, use }) =>
      Array.from(use.matchAll(/<\/?[A-Za-z][^<>]*>/g))
        .filter(([form]) => !/<a /.test(renderMarkdownToHtml(form)))
        .map(([form]) => `${label}: ${form} in "${use}" ships escaped`)
    );

    expect(escaped).toEqual([]);
  });

  // The raw HTML rule, measured the way every rule in this file is: against the
  // renderer, over a table of forms, with one answer required from both sides.
  //
  // It needs a different oracle than the rules above, because on the page the
  // defect leaves no trace. `<del>40</del>` reaches the reader as the literal
  // text `<del>40</del>`; `5 < 10` reaches the reader as the literal text
  // `5 < 10`. One is markup the renderer refused and the other is punctuation
  // the author typed, and the rendered HTML holds the same escaped bracket for
  // both — so "does the output contain &lt;" cannot separate them, and neither
  // can any pattern read off the output.
  //
  // rehype-raw is the renderer that can: it keeps exactly what this one
  // escapes, so a form is raw HTML if and only if turning it on changes what
  // ships. That is also the honest statement of the lint — the body is written
  // for a renderer without it — and it stays true if the product ever gains it,
  // at which point the two renders agree everywhere, this gate demands zero
  // flags, and the rule goes red instead of silently outliving its reason.
  //
  // The two autolinks are the rows that matter most: they are the forms a
  // bracket-matching rule rejects, and one of them is what the bare-email row's
  // advice tells the author to write. The four code rows are not exemptions
  // applied here — `unsupportedIn` is called on the raw source, without
  // stripCode — but the parser declining to call a sample's tag an `html` node.
  it("flags a form if and only if rehype-raw would change what ships", () => {
    const forms = [
      // The three rows the issue measured, then the same `br` inline in a
      // paragraph rather than alone in a block, the `div` the stripCode table
      // above already leans on as a case built on raw HTML escaping, and one
      // more ordinary inline tag. The `span` carries an attribute, which is the
      // form a tag pattern spelled as "brackets around no whitespace" misses.
      "The price was <del>40</del> 20.",
      '<span style="text-decoration:line-through">struck</span>',
      "<br />",
      "Line one.<br />Line two.",
      "<div>\nBODY\n</div>",
      "<kbd>Ctrl</kbd>",
      // The only tag here whose element `components` maps, and it escapes like
      // any other: the map is reached through markdown, not through the tag.
      '<a href="https://example.com/">raw anchor</a>',
      // No tag name at all, so every tag pattern misses it and the reader is
      // shown a comment that was meant to be invisible.
      "<!-- a note -->",
      "Prose with <!-- inline note --> in it.",
      // CommonMark autolinks. Real anchors, and `<hello@example.com>` is the
      // bare-email row's own advice — flagging either is PRA-1010 again.
      "See <https://example.com/x> here.",
      "See <hello@example.com> here.",
      // Prose punctuation. The last is the near-miss of the tag production: a
      // bracket against a letter, with nothing closing it.
      "A value under 5 < 10 holds.",
      "Compare 3 < 5 and 9 > 2.",
      "A stray 5 <x in prose.",
      // A tag is someone else's syntax in all four ways to write a sample.
      "See `<del>40</del>` here.",
      "See ``<del>40</del>`` here.",
      "```\n<del>40</del>\n```\n",
      "Prose.\n\n    <del>40</del>\n",
      // Prose that must survive: the strikethrough rule above still has to see
      // its own tildes, and a body with no brackets is the control.
      "See ~~struck~~ here.",
      "Plain prose with **bold**.",
    ];

    const disagreements = forms.flatMap((markdown) => {
      const kept = renderMarkdownToHtml(markdown, [rehypeRaw]);
      const escapes = renderMarkdownToHtml(markdown) !== kept;
      const flagged = unsupportedIn(markdown).filter(
        ({ label }) => label === RAW_HTML.label
      );

      return (flagged.length > 0) === escapes
        ? []
        : [
            `${JSON.stringify(markdown)} ` +
              (escapes
                ? "is raw HTML and nothing flags it"
                : `renders as written but is flagged as ${JSON.stringify(
                    flagged.map(({ text }) => text)
                  )}`),
          ];
    });

    expect(disagreements).toEqual([]);
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
  // The fix is a blank line, which is the separator that survives an editor.
  // A hard break does work — `**One.**  \n**Two.**` emits a real `<br/>`,
  // because react-markdown falls through to the default element for every tag
  // `components` does not name — but it is spelled with two invisible trailing
  // spaces, so the version this file used to claim ("`br` is not in the
  // renderer's tag map, so it renders as nothing") was wrong about the reason
  // while landing on the right advice. Measured 2026-08-16 (PRA-1052).
  it("does not fold a post's stacked bold lines into one paragraph", () => {
    const offenders = posts.flatMap((post) => {
      const body = markdownSource(post.slug);
      const lines = body.split("\n");

      return stackedBoldLeads(body).map(
        ([first, second]) =>
          `${post.slug}: two bold lines with no blank line between them ` +
          `render as one paragraph — "${lines[first - 1].trim().slice(0, 40)}" ` +
          `then "${lines[second - 1].trim().slice(0, 40)}"`
      );
    });

    expect(offenders).toEqual([]);
  });

  // The corpus check above passes on every published post and banked draft, and
  // passed just as green while it could see exactly one of the five ways to
  // write the defect. `line.startsWith("**")` reads column 0, where the
  // renderer's rule is about block structure, so `__bold__`, an indented line,
  // a blockquote, a list item's continuation and a line whose bold sits behind
  // a code chip all shipped the run-on the gate exists to catch — each of them
  // rendering markup byte-identical to the row it was written for.
  //
  // So this asks both sides the same question and requires one answer: a form
  // is flagged if and only if the renderer folds it into one flow. The rows
  // below were each checked against a mutated rule to make sure they are
  // evidence rather than decoration — the spelling rows go red if the gate
  // reads columns again, the code rows if a code chip counts as copy, the
  // `<br/>` rows if a hard break stops being a break, the setext row if
  // headings are skipped, and the blank-line row if a blank line stops
  // separating (PRA-1052).
  it("flags stacked bold lines if and only if the renderer folds them", () => {
    const forms = [
      // The row the gate was written for, and the four spellings of it that
      // read column 0 and found nothing. A tab is one character and four
      // columns, and an indented code block cannot interrupt a paragraph, so
      // the 4-space line below is lazy continuation and folds like the rest.
      "**One.**\n**Two.**\n",
      "__One.__\n__Two.__\n",
      "**One.**\n__Two.__\n",
      "**One.**\n   **Two.**\n",
      "**One.**\n    **Two.**\n",
      "**One.**\n\t**Two.**\n",
      // The shape the defect actually arrives in: a label and its definition.
      "**One.** Def one.\n**Two.** Def two.\n",
      // Code is not copy, so a chip in front of the bold does not stop the line
      // opening with it. The second is a span pairing across a line break: it
      // renders `<code>a b</code>`, one rendered line out of two source lines,
      // which is why the pair cannot be found by counting source lines.
      "**One.**\n`x`**Two.**\n",
      "**One.**\n`a\nb`**Two.**\n",
      // Container blocks. The bold is in the same place relative to its
      // container and nowhere near column 0; the third is lazy continuation,
      // which folds into the quote above it.
      "> **One.**\n> **Two.**\n",
      "- **One.**\n  **Two.**\n",
      "1. **One.**\n   **Two.**\n",
      "> **One.**\n**Two.**\n",
      // A link and an emphasis wrap the bold rather than preceding it.
      "[**One.**](/a/)\n[**Two.**](/b/)\n",
      "*__One.__*\n*__Two.__*\n",
      // A setext heading is written over as many lines as the author likes and
      // folds them exactly as a paragraph does.
      "**One.**\n**Two.**\n---\n",
      // Copy that must survive, each a near-miss of a row above. The blank line
      // is the fix this rule asks for, so it has to come out the other side or
      // every row above is decoration.
      "**One.**\n\n**Two.**\n",
      "- **One.**\n- **Two.**\n",
      "# **One.**\n**Two.**\n",
      "**One.** Def one. **Two.** Def two.\n",
      // A hard break, in both spellings. Two rendered lines, so no fold.
      "**One.**  \n**Two.**\n",
      "**One.**\\\n**Two.**\n",
      // A bold that does not open its line is prose emphasis, not a label, and
      // stacked prose emphasis is how a wrapped paragraph reads.
      "**One.**\nSee **Two.** here\n",
      "Text **One.** more\ntext **Two.** more\n",
      // The break belongs to the bold run rather than separating two of them.
      "**One.\nTwo.**\n**Three.**\n",
      // An image paints ahead of the bold, so that line opens with the image.
      "**One.**\n![alt](/i.png)**Two.**\n",
      // Not copy at all: two of these are code and the third ships escaped.
      "```\n**One.**\n**Two.**\n```\n",
      "Prose.\n\n    **One.**\n    **Two.**\n",
      "<div>\n**One.**\n**Two.**\n</div>\n",
      // Emphasis is deliberately out of scope. A stacked `*italic*` pair folds
      // the same way, but a line opening with an italic is ordinary prose — a
      // cited publication, a ship name — far more often than it is a label,
      // and this gate rejects what it flags.
      "*One.*\n*Two.*\n",
    ];

    const disagreements = forms.flatMap((markdown) => {
      const folds = rendersStackedBold(renderMarkdownToHtml(markdown));
      const flagged = stackedBoldLeads(markdown).length > 0;

      return flagged === folds
        ? []
        : [
            `${JSON.stringify(markdown)} ` +
              (folds
                ? "renders as one folded flow and nothing flags it"
                : "renders as separate lines but is flagged"),
          ];
    });

    expect(disagreements).toEqual([]);
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
