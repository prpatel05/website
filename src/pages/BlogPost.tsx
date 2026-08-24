import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { m } from "framer-motion";
import { ArrowLeft, ArrowRight, Clock, Calendar } from "lucide-react";
import {
  getAdjacentPosts,
  getPostBySlug,
  loadPostContent,
  posts,
} from "@/data/blog-posts/registry";
import NotFound from "./NotFound";
import SEO from "@/components/SEO";
import { TagChip } from "@/components/TagChip";
import ReadingProgress from "@/components/ReadingProgress";
import PostToc from "@/components/PostToc";
import PostShare from "@/components/PostShare";
import PostSeriesRail from "@/components/PostSeriesRail";
import { canonicalUrl } from "@/lib/canonical-url";
import { postDescription } from "@/lib/post-description";
import { heroFor, HERO_SIZES } from "@/lib/hero";
import { blogPostCardFor } from "@/lib/social-cards";
import { useEntrance, useFirstLoad } from "@/hooks/useEntrance";
import { mainContentProps } from "@/lib/skip-target";
import { postTitle } from "@/lib/route-title";
import { POST_BODY_ATTR, prerenderedBody } from "@/lib/prerendered-body";
import {
  clearPostBodyRecovery,
  recoverPostBody,
} from "@/lib/post-body-recovery";
import { tocFromHtml } from "@/lib/post-toc";
import { seriesPosition } from "@/lib/blog-series";
import { personRef } from "@/lib/person-jsonld";
import { wordCountFromHtml } from "@/lib/word-count";
import { useActiveHeading } from "@/hooks/useActiveHeading";

/**
 * The shape of the placeholder: a heading bar and a few line bars per section,
 * as fractions of the column. Written as literal Tailwind classes rather than
 * computed widths because a class that is only ever assembled at runtime is
 * never compiled into the stylesheet.
 */
const SKELETON_BLOCKS = [
  ["w-full", "w-11/12", "w-full", "w-8/12"],
  ["w-full", "w-10/12", "w-full", "w-6/12"],
  ["w-11/12", "w-full", "w-9/12"],
  ["w-full", "w-full", "w-7/12"],
];

/**
 * What the article region shows while the body chunk is in flight.
 *
 * Only a client-side navigation can see it: a document load reads the body out
 * of its own prerendered markup, so `content` is never empty there. A POP
 * counts as one — pressing Back onto the post the tab was loaded on returns to
 * a route whose markup `AnimatePresence` unmounted on the way out, so the body
 * is fetched as coldly there as on any forward click. On such a
 * navigation the body is a dynamic import, and until it resolves the page used
 * to paint the meta, title, subtitle, hero and the whole end-of-post footer
 * against `content === ""` — a post that looks published with no words in it,
 * with the newer/older cards sitting directly under the hero. Measured on a
 * 1500ms-delayed chunk: 0 body characters and a 1203px document for the length
 * of the round trip, then 14957 characters and 5764px. Unthrottled the window
 * closes inside one 60ms sample, so this is a slow-connection defect and the
 * `unrecovered` fallback below does not cover it — that one is about a chunk
 * that never arrives at all.
 *
 * The bars are `aria-hidden`: they are a picture of text, and a screen reader
 * announcing four blocks of nothing is worse than silence. The `// loading`
 * line is the accessible half and is left in the reading order — the same
 * device `// error:body` uses one case over. Not a live region: this markup
 * mounts with the incoming route rather than mutating a node that was already
 * there, and a region that mounts with its own content announces nothing (see
 * `RouteAnnouncer` in App.tsx). The route announcer has already said which post
 * this is.
 */
const PostBodySkeleton = () => (
  <div className="font-mono text-sm">
    <span className="text-primary/60 print:text-primary tracking-widest block mb-6">
      {"// loading"}
    </span>
    <div aria-hidden="true" className="animate-pulse space-y-8">
      {SKELETON_BLOCKS.map((lines, block) => (
        <div key={block}>
          <div className="h-5 w-5/12 bg-muted mb-5" />
          <div className="space-y-3">
            {lines.map((width, line) => (
              <div key={line} className={`h-3 bg-muted/60 ${width}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;
  const firstLoad = useFirstLoad();
  // Read once, during the first render — the moment at which the prerendered
  // markup is still on the page and React has not touched it yet.
  const [prerendered] = useState(() => (firstLoad ? prerenderedBody(slug) : ""));
  const [content, setContent] = useState(prerendered);
  const [unrecovered, setUnrecovered] = useState(false);
  const entrance = useEntrance();
  const articleRef = useRef<HTMLElement>(null);
  const toc = useMemo(() => tocFromHtml(content), [content]);
  const headingIds = useMemo(() => toc.map((entry) => entry.id), [toc]);
  const activeId = useActiveHeading(headingIds);

  useEffect(() => {
    if (!post) return;
    // Nothing to fetch when the body arrived with the document — but this is
    // also the only path a successful recovery takes, so it is where the mark
    // has to be released. `recoverPostBody` answers a missing body with a full
    // load of the same URL, whose HTML carries the body, so the reload lands
    // here and the `clearPostBodyRecovery` in the `.then` below is unreachable
    // on exactly the journey that earns it. Left to the `.then`, the mark
    // stayed set for the life of the tab: a reader who sits through a second
    // deploy and clicks the same post again gets `recoverPostBody` declining a
    // reload that would have worked, and the `// error:body` dead end instead
    // of the post.
    if (prerendered) {
      clearPostBodyRecovery(post.slug);
      return;
    }
    let live = true;
    loadPostContent(post.slug)
      .then((md) => {
        if (!live) return;
        setContent(md);
        clearPostBodyRecovery(post.slug);
      })
      // The import rejects when the chunk it names is gone, which is what a
      // deploy does to a tab that was already open. Without this the article
      // stays empty for good: `content` never leaves "", and the page reads as
      // a post that was published with no words in it.
      .catch(() => {
        if (live && !recoverPostBody(post.slug)) setUnrecovered(true);
      });
    return () => {
      live = false;
    };
  }, [post, prerendered]);

  if (!post) return <NotFound />;

  /**
   * The body has been asked for and has not arrived, and nothing has gone
   * wrong yet.
   *
   * This used to also require `!firstLoad`, to keep the skeleton away from a
   * document load: the prerenderer drives a real browser, where the first
   * render is a "first load" with an empty body, and a skeleton captured into
   * the HTML — or disagreeing with it at hydration — is the failure
   * `prerenderedBody` exists to prevent.
   *
   * But `firstLoad` is `key === loadedOnKey`, and the prerender pass is not the
   * only way that goes true. react-router restores the *same* key on a POP back
   * to the entry the document loaded on, so a reader who opens a post from a
   * search result, clicks `ls ../posts` and presses Back is on `firstLoad`
   * again — with the prerendered markup long gone, unmounted by
   * `AnimatePresence mode="wait"` on the way out. `prerenderedBody` returns ""
   * and the effect above fires a cold import of a chunk the first load never
   * had reason to fetch. Measured on that Back: the body chunk requested, 0
   * body characters, no placeholder, and the newer/older cards sitting directly
   * under the hero in an 1111px document that became 4196px when the chunk
   * landed — PRA-914's defect, reached by the one path its fix did not cover.
   *
   * `!content` alone is the honest condition, and it says the same thing about
   * a document load without going through the router: `content` is seeded from
   * `prerenderedBody`, so on a load that has a body it is non-empty at the
   * first render and `pending` is false before hydration can compare anything.
   * The prerender pass is the case where it is legitimately true for a moment,
   * and that moment is over long before the snapshot — `prerender.mjs` settles
   * the network and then refuses to write a post page with fewer than 3
   * paragraphs in it, so a skeleton that ever did reach the HTML would fail the
   * build rather than ship.
   */
  const pending = !content && !unrecovered;

  const { newer, older } = getAdjacentPosts(posts, post.slug);
  const series = seriesPosition(posts, post.slug);

  // Scrapers get the derived JPEG card, not the WebP master: LinkedIn's image
  // spec does not list WebP. `blogPostCardFor` returns null only for a hero
  // the build does not own, in which case the master is still the best
  // available — and its size is unknown here, so og:image:width/height go
  // undeclared rather than wrong. See @/lib/social-cards.
  const card = blogPostCardFor(post.image);
  const cardPath = card?.path ?? post.image;
  const ogImage = cardPath.startsWith("/")
    ? `https://pratik.pa.tel${cardPath}`
    : cardPath;

  // Only what the page paints picks from the candidate list.
  const hero = heroFor(post.image);
  const heroSrc = hero?.src ?? post.image;

  const postUrl = canonicalUrl(`https://pratik.pa.tel/blog/${post.slug}`);
  const words = wordCountFromHtml(content);

  const blogPostJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: postDescription(post),
      datePublished: post.dateISO,
      dateModified: post.dateISO,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": postUrl,
      },
      wordCount: words,
      inLanguage: "en",
      image: card
        ? {
            "@type": "ImageObject",
            url: ogImage,
            width: card.width,
            height: card.height,
          }
        : ogImage,
      url: postUrl,
      author: personRef,
      publisher: personRef,
      keywords: post.tags.join(", "),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://pratik.pa.tel",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Blog",
          item: canonicalUrl("https://pratik.pa.tel/blog"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: post.title,
          item: canonicalUrl(`https://pratik.pa.tel/blog/${post.slug}`),
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={postTitle(post.title)}
        description={postDescription(post)}
        canonical={`https://pratik.pa.tel/blog/${post.slug}`}
        markdownAlternate={`https://pratik.pa.tel/blog/${post.slug}.md`}
        ogImage={ogImage}
        ogImageAlt={post.title}
        ogImageWidth={card?.width}
        ogImageHeight={card?.height}
        ogType="article"
        articlePublishedTime={post.dateISO}
        articleTags={post.tags}
        preloadImage={heroSrc}
        preloadImageSrcSet={hero?.srcSet}
        preloadImageSizes={hero ? HERO_SIZES : undefined}
        jsonLd={blogPostJsonLd}
      />
      {/* Header */}
      <nav aria-label="Main" className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="container flex items-center h-16">
          <Link
            to="/"
            className="font-mono text-xs text-primary flex items-center gap-2 py-1 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            cd ~
          </Link>
        </div>
      </nav>

      <ReadingProgress target={articleRef} enabled={Boolean(content)} />

      <main {...mainContentProps}>
        <article ref={articleRef} className="pt-28 pb-24">
          {/* One TOC in the DOM: in flow under the hero on small screens, a sticky rail from xl. The article column stays max-w-3xl; only the wrapper grows to make room for the rail. */}
          <div className={toc.length > 0 ? "container max-w-3xl xl:max-w-[64rem] xl:grid xl:grid-cols-[minmax(0,48rem)_14rem] xl:gap-x-10" : "container max-w-3xl"}>
          {/* Meta */}
          <m.div
            /*
              Title, subtitle and tags are all post-derived text, and a post is
              free to contain a word wider than a 320px viewport: the title
              "Non-Deterministic Is Not the Same as Unmeasurable" renders
              `Unmeasurable` at 299px once a reader applies SC 1.4.12 spacing,
              against a 288px budget, which put 11px of sideways scroll on the
              page (PRA-977).

              `overflow-wrap` is inherited, so this one declaration covers all
              three elements below. It sits on the header rather than on the
              `<h1>` alone on purpose: the body wrapper's identical rule
              (PRA-963) failed to reach the title precisely because the title is
              outside that wrapper, and a rule scoped to one element would have
              left the subtitle and the chips to be found the same way, one
              queued post at a time.
            */
            className="[overflow-wrap:anywhere]"
            initial={entrance({ opacity: 0, y: 20 })}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                {post.date}
              </span>
              <span aria-hidden="true" className="text-border">|</span>
              <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {post.readTime}
              </span>
              {post.tags.map((tag) => (
                <TagChip key={tag} tag={tag} />
              ))}
            </div>

            <h1 className="font-display text-4xl lg:text-6xl font-bold text-foreground leading-tight">
              {post.title}
            </h1>
            <p className="font-mono text-lg text-accent text-glow-accent mt-3">
              {post.subtitle}
            </p>
          </m.div>

          {/* Hero image */}
          <m.div
            initial={entrance({ opacity: 0, y: 20 })}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="my-10 border border-border overflow-hidden"
          >
            {/*
              This is the LCP element on a post page — it sits in the initial
              viewport at every breakpoint. It must stay eager: lazy hides an
              image from the preload scanner, so the fetch cannot start until
              layout has run. The priority hint rides on the <link rel="preload">
              in the head — react-dom 18 does not map a fetchPriority prop onto
              an <img>, so putting it here only produces a console warning.

              The preload in the head carries this same srcSet and sizes. If it
              named a single href instead, the scanner and the img would run
              different selections and the page would download the hero twice.

              `alt=""` because the heroes are decorative abstract art that
              illustrates nothing the text does not say. It used to carry
              `post.title` — verbatim the `<h1>` thirty lines above, on 24 of 24
              posts — so a screen reader read the title, then the identical
              title again as the description of the picture. An empty alt is
              what takes a decorative image out of the accessibility tree; a
              missing one makes the reader fall back to announcing the filename.
              og:image:alt keeps the title: a scraper shows the card with no
              page around it, so there the title is the only description there
              is.
            */}
            <img
              src={heroSrc}
              srcSet={hero?.srcSet}
              sizes={hero ? HERO_SIZES : undefined}
              alt=""
              loading="eager"
              width={768}
              height={432}
              className="w-full aspect-video object-cover"
            />
          </m.div>

          {/*
            Same rail as the footer instance. Up here it is the companion: you
            can see you are in the arc before the TOC and the body. Membership
            is metadata, so this one does not wait for the body chunk.
          */}
          {series && (
            <PostSeriesRail position={series} placement="top" className="my-8" />
          )}

          {toc.length > 0 && (
            <aside className="my-8 xl:my-0 xl:col-start-2 xl:row-start-1 xl:row-span-5">
              <div className="xl:sticky xl:top-24">
                <PostToc entries={toc} activeId={activeId} />
              </div>
            </aside>
          )}

          {/* Content */}
          <m.div
            initial={entrance({ opacity: 0 })}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            /*
              The reading column is Space Grotesk (`font-display`) at `text-base`
              / `leading-7`, not the site's JetBrains Mono chrome. Code, `em`,
              and every rail around this wrapper pin `font-mono` themselves.

              `overflow-wrap` is inherited, so one declaration here is the whole
              body's wrapping policy: a long unbreakable token — a bare URL, a
              fully-qualified name, an error code — breaks rather than pushing
              the page wider than the viewport. Measured at 320px (a 1280px
              screen at 400% zoom, WCAG 2.1 SC 1.4.10), the pre-fix body
              overflowed by 504px on a URL in a list item, 343px on a token in
              an `h2`, and 73px on one in a plain paragraph.

              Here rather than per element in `scripts/markdown-html.mjs`, for
              two reasons. The headings were the tell: fixing `p`, `li` and `a`
              — the elements the failure was reported against — still left `h2`
              at 343px and `h3` at 223px, and that list would have to be
              re-audited every time the element map grows. The map is also a
              whitelist, so a tag with no entry (`h4`, `hr`, a table) renders
              unstyled and would arrive unprotected. Inheritance covers all of
              them, including elements nobody has written yet.

              `anywhere` and not `break-word`, and the difference is the fix.
              `li` renders as a flex row, so its content span is a flex item at
              `min-width: auto` whose floor is its min-content width.
              `break-word` adds a break opportunity for line breaking but
              pointedly does not feed min-content, so that floor stays the full
              token width: measured, the three list cases were unchanged at 504,
              110 and 110px with `break-word` applied. Only `anywhere`'s breaks
              count toward min-content. Neither breaks a token that would fit on
              a line of its own, so the readability cost is paid only where the
              alternative is a sideways scroll.

              A fenced block is unaffected despite inheriting this: `white-space:
              pre` disables soft wrapping outright, so `pre` keeps its own
              horizontal scroller. Measured — 299px of internal scroll, before
              and after. Arbitrary property because Tailwind 3 ships no
              `anywhere` utility.
            */
            className="font-display text-base leading-7 [overflow-wrap:anywhere]"
            // Read back by `prerenderedBody` on first load, so hydration finds
            // the body already in state instead of replacing this subtree.
            {...{ [POST_BODY_ATTR]: post.slug }}
            /*
              The body is markdown in the repo but arrives here as HTML: the
              markdownHtml Vite plugin renders it at build time with the element
              map this file used to hold. The string is our own content off the
              filesystem, never user input, and the parser it replaces was 36KB
              gzip on every post page.
            */
            dangerouslySetInnerHTML={{ __html: content }}
          />

          {pending && <PostBodySkeleton />}

          {/*
            Only reachable once the reload has already been spent on this post,
            so it is the honest end of the line rather than a first response:
            the body did not arrive and asking for the page again did not fix
            it. Says so, and offers the way out that does not depend on the
            chunk — the index, which is prerendered.
          */}
          {unrecovered && (
            <div className="font-mono text-sm">
              <span className="text-primary/60 print:text-primary tracking-widest block mb-4">
                {"// error:body"}
              </span>
              <p className="text-muted-foreground mb-8">
                This post's text didn't load. Reloading the page usually fixes
                it — this tab already tried once.
              </p>
              <Link
                to="/blog/"
                // Background-only button: forced colours flatten it to Canvas, so it needs
                // a real border to stay identifiable as a control. See PRA-998.
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 hover:bg-primary/90 transition-colors forced-colors:border forced-colors:border-[ButtonText]"
              >
                <ArrowLeft className="w-4 h-4" />
                cd ~/blog
              </Link>
            </div>
          )}

          {/*
            Footer. Held back while the body is in flight: this block is the
            end of the article — a rule, the share/subscribe row, the
            newer/older cards, the archive link — and drawing an end under a
            post that has not started yet is the half of the defect a skeleton
            alone does not fix. It rendered directly beneath the hero, 952px
            down a 1203px document, so the reader was offered the next post
            before this one had any words.
          */}
          {!pending && (
          <m.div
            initial={entrance({ opacity: 0 })}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-16 pt-8 border-t border-border"
          >
            <PostShare slug={post.slug} title={post.title} />
            {series && (
              <PostSeriesRail
                position={series}
                placement="footer"
                className="mb-8 print:hidden"
              />
            )}
            {(newer || older) && (
              <nav
                aria-label="More posts"
                className="grid gap-4 sm:grid-cols-2 mb-8"
              >
                {newer && (
                  <Link
                    to={`/blog/${newer.slug}/`}
                    className="group border border-border p-4 hover:border-primary/50 transition-colors"
                  >
                    <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-2">
                      <ArrowLeft className="w-3 h-3" />
                      newer
                    </span>
                    <span className="block mt-2 font-display text-base font-bold text-foreground group-hover:text-primary transition-colors">
                      {newer.title}
                    </span>
                  </Link>
                )}
                {older && (
                  <Link
                    to={`/blog/${older.slug}/`}
                    className="group border border-border p-4 hover:border-primary/50 transition-colors sm:col-start-2 sm:text-right"
                  >
                    <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-2 sm:justify-end">
                      older
                      <ArrowRight className="w-3 h-3" />
                    </span>
                    <span className="block mt-2 font-display text-base font-bold text-foreground group-hover:text-primary transition-colors">
                      {older.title}
                    </span>
                  </Link>
                )}
              </nav>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <Link
                to="/blog/"
                className="font-mono text-xs text-primary hover:text-foreground transition-colors flex items-center gap-2 py-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                ls ../posts
              </Link>
              <span className="font-mono text-[10px] text-muted-foreground">
                © {new Date().getFullYear()} PRATIK PATEL
              </span>
            </div>
          </m.div>
          )}
          </div>
        </article>
      </main>
    </div>
  );
};

export default BlogPost;
