import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Clock, Calendar } from "lucide-react";
import ReactMarkdown, { Components } from "react-markdown";
import {
  getAdjacentPosts,
  getPostBySlug,
  loadPostContent,
  posts,
} from "@/data/blog-posts/registry";
import NotFound from "./NotFound";
import SEO from "@/components/SEO";
import { canonicalUrl } from "@/lib/canonical-url";
import { heroFor, HERO_SIZES } from "@/lib/hero";
import { BLOG_POST_CARD } from "@/lib/social-cards";

const markdownComponents: Components = {
  h2: ({ children }) => (
    <h2 className="font-display text-2xl lg:text-3xl font-bold text-foreground mt-12 mb-6 border-l-2 border-primary pl-4">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-display text-xl font-bold text-foreground mt-10 mb-4">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-muted-foreground leading-relaxed my-4">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="space-y-2 my-6 ml-4">{children}</ul>
  ),
  li: ({ children }) => (
    <li className="flex gap-3 text-muted-foreground leading-relaxed">
      <span className="text-primary shrink-0 mt-1.5">▸</span>
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => (
    <strong className="text-foreground font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-primary/80">{children}</em>
  ),
};

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!post) return;
    let live = true;
    loadPostContent(post.slug).then((md) => {
      if (live) setContent(md);
    });
    return () => {
      live = false;
    };
  }, [post]);

  if (!post) return <NotFound />;

  const { newer, older } = getAdjacentPosts(posts, post.slug);

  const ogImage = post.image.startsWith("/")
    ? `https://pratik.pa.tel${post.image}`
    : post.image;

  // The card scrapers keep getting the full-size master via `ogImage`; only
  // what the page paints picks from the candidate list.
  const hero = heroFor(post.image);
  const heroSrc = hero?.src ?? post.image;

  const blogPostJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.subtitle,
      datePublished: post.dateISO,
      image: ogImage,
      url: canonicalUrl(`https://pratik.pa.tel/blog/${post.slug}`),
      author: {
        "@type": "Person",
        name: "Pratik Patel",
        url: "https://pratik.pa.tel",
      },
      publisher: {
        "@type": "Person",
        name: "Pratik Patel",
        url: "https://pratik.pa.tel",
      },
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
        title={`${post.title} — Pratik Patel`}
        description={post.subtitle}
        canonical={`https://pratik.pa.tel/blog/${post.slug}`}
        ogImage={ogImage}
        ogImageAlt={post.title}
        ogImageWidth={BLOG_POST_CARD.width}
        ogImageHeight={BLOG_POST_CARD.height}
        ogType="article"
        articlePublishedTime={post.dateISO}
        preloadImage={heroSrc}
        preloadImageSrcSet={hero?.srcSet}
        preloadImageSizes={hero ? HERO_SIZES : undefined}
        jsonLd={blogPostJsonLd}
      />
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="container flex items-center h-16">
          <Link
            to="/"
            className="font-mono text-xs text-primary flex items-center gap-2 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            cd ~
          </Link>
        </div>
      </nav>

      <article className="pt-28 pb-24">
        <div className="container max-w-3xl">
          {/* Meta */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                {post.date}
              </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {post.readTime}
              </span>
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="font-mono text-[10px] text-primary/60 border border-primary/20 px-2 py-0.5"
                >
                  #{tag}
                </span>
              ))}
            </div>

            <h1 className="font-display text-4xl lg:text-6xl font-bold text-foreground leading-tight">
              {post.title}
            </h1>
            <p className="font-mono text-lg text-accent text-glow-accent mt-3">
              {post.subtitle}
            </p>
          </motion.div>

          {/* Hero image */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
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
            */}
            <img
              src={heroSrc}
              srcSet={hero?.srcSet}
              sizes={hero ? HERO_SIZES : undefined}
              alt={post.title}
              loading="eager"
              width={768}
              height={432}
              className="w-full aspect-video object-cover"
            />
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="font-mono text-sm"
          >
            <ReactMarkdown components={markdownComponents}>
              {content}
            </ReactMarkdown>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-16 pt-8 border-t border-border"
          >
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
                className="font-mono text-xs text-primary hover:text-foreground transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                ls ../posts
              </Link>
              <span className="font-mono text-[10px] text-muted-foreground">
                © {new Date().getFullYear()} PRATIK PATEL
              </span>
            </div>
          </motion.div>
        </div>
      </article>
    </div>
  );
};

export default BlogPost;
