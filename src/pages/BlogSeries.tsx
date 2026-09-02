import { Link } from "react-router-dom";
import { m } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { posts } from "@/data/blog-posts/registry";
import SEO from "@/components/SEO";
import { SITE_CARD } from "@/lib/social-cards";
import { useEntrance } from "@/hooks/useEntrance";
import { mainContentProps } from "@/lib/skip-target";
import { SERIES_TITLE } from "@/lib/route-title";
import { personRef } from "@/lib/person-jsonld";
import { ARCHIVE_HREF } from "@/lib/blog-tags";
import {
  SERIES_DESCRIPTION,
  SERIES_HREF,
  SERIES_NAME,
  SERIES_PATH,
  seriesMembers,
} from "@/lib/blog-series";
import { postDescription } from "@/lib/post-description";

const members = seriesMembers(posts);

const BlogSeries = () => {
  const entrance = useEntrance();
  const seriesUrl = `https://pratik.pa.tel${SERIES_HREF}`;
  const [seriesLead, ...seriesRest] = SERIES_NAME.split(" ");

  const seriesJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: SERIES_NAME,
      description: SERIES_DESCRIPTION,
      // Trailing slash throughout: GitHub Pages 301s the bare form, and a
      // structured-data URL that redirects is the same defect #45 fixes for
      // canonical/og:url.
      url: seriesUrl,
      isPartOf: {
        "@type": "Blog",
        name: "Blog",
        url: "https://pratik.pa.tel/blog/",
      },
      author: personRef,
      publisher: personRef,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: members.length,
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        itemListElement: members.map((post, i) => {
          const url = `https://pratik.pa.tel/blog/${post.slug}/`;
          return {
            "@type": "ListItem",
            position: i + 1,
            url,
            item: {
              "@type": "BlogPosting",
              headline: post.title,
              description: postDescription(post),
              datePublished: post.dateISO,
              dateModified: post.dateISO,
              mainEntityOfPage: {
                "@type": "WebPage",
                "@id": url,
              },
              inLanguage: "en",
              url,
              image: post.image.startsWith("/")
                ? `https://pratik.pa.tel${post.image}`
                : post.image,
              author: personRef,
              keywords: post.tags.join(", "),
            },
          };
        }),
      },
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
          item: "https://pratik.pa.tel/blog/",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: SERIES_NAME,
          item: seriesUrl,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={SERIES_TITLE}
        description={SERIES_DESCRIPTION}
        // Same shape as Blog.tsx: bare path; SEO.tsx's canonicalUrl adds the
        // trailing slash GitHub Pages serves.
        canonical={`https://pratik.pa.tel${SERIES_PATH}`}
        ogImage={SITE_CARD.url}
        ogImageAlt={`${SERIES_NAME} — Pratik Patel — pratik.pa.tel`}
        ogImageWidth={SITE_CARD.width}
        ogImageHeight={SITE_CARD.height}
        jsonLd={seriesJsonLd}
      />
      <nav
        aria-label="Main"
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border"
      >
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

      <main {...mainContentProps} className="pt-28 pb-24">
        <div className="container max-w-3xl">
          <m.div
            initial={entrance({ opacity: 0, y: 20 })}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="font-mono text-xs text-primary/60 print:text-primary tracking-widest block mb-2">
              {"// series"}
            </span>
            <h1 className="font-display text-4xl lg:text-6xl font-bold mb-4">
              <span className="text-foreground">{seriesLead}</span>{" "}
              <span className="text-accent text-glow-accent">
                {seriesRest.join(" ")}
              </span>
            </h1>
            <p className="font-mono text-sm text-muted-foreground mb-4 max-w-2xl">
              {SERIES_DESCRIPTION}
            </p>
            <p className="font-mono text-xs text-muted-foreground mb-10">
              {members.length} {members.length === 1 ? "post" : "posts"} · oldest
              first
            </p>
          </m.div>

          {/*
            `list-none` drops the browser's numerals so the mono index stays the
            only number a reader sees; the `<ol>` still exposes ordered-list
            semantics to AT.
          */}
          <ol className="space-y-4 list-none">
            {members.map((post, i) => (
              <m.li
                key={post.slug}
                initial={entrance({ opacity: 0, y: 20 })}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: Math.min(i, 5) * 0.1 }}
                className="group relative border border-border bg-card hover:border-primary/40 transition-all duration-500 p-6"
              >
                <div className="flex gap-4 [overflow-wrap:anywhere]">
                  <span
                    aria-hidden="true"
                    className="font-mono text-xs text-primary/60 print:text-primary pt-1 shrink-0 w-6"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {post.date}
                      </span>
                      <span aria-hidden="true" className="text-border">
                        |
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {post.readTime}
                      </span>
                    </div>
                    <h2 className="font-display text-xl lg:text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                      <Link
                        to={`/blog/${post.slug}/`}
                        className="before:absolute before:inset-0 before:z-0"
                      >
                        {post.title}
                      </Link>
                    </h2>
                    <p className="font-mono text-sm text-muted-foreground mt-1">
                      {post.subtitle}
                    </p>
                  </div>
                </div>
              </m.li>
            ))}
          </ol>

          <p className="mt-12 font-mono text-xs">
            <Link
              to={ARCHIVE_HREF}
              className="text-primary hover:text-foreground transition-colors inline-flex items-center gap-2 min-h-6"
            >
              <ArrowLeft className="w-3 h-3" aria-hidden="true" />
              back to /blog/
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default BlogSeries;
