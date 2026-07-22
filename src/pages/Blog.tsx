import { Link } from "react-router-dom";
import { m } from "framer-motion";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { posts } from "@/data/blog-posts/registry";
import SEO from "@/components/SEO";
import { SITE_CARD } from "@/lib/social-cards";
import { THUMBNAIL_SIZES, thumbnailFor } from "@/lib/blog-thumbnails";
import { useEntrance } from "@/hooks/useEntrance";

const BLOG_DESCRIPTION =
  "Articles on engineering leadership, AI, career growth, and technical architecture by Pratik Patel, CTO & Chief Architect.";

const author = {
  "@type": "Person",
  name: "Pratik Patel",
  url: "https://pratik.pa.tel",
};

const Blog = () => {
  const entrance = useEntrance();
  // The archive is the entry point crawlers reach before any individual post,
  // so it names every post here rather than leaving them to be discovered one
  // BlogPosting at a time.
  const blogJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Blog — Pratik Patel",
      description: BLOG_DESCRIPTION,
      // Trailing slash throughout: GitHub Pages 301s the bare form, and a
      // structured-data URL that redirects is the same defect #45 fixes for
      // canonical/og:url. The bare origin is served directly, so it stays bare.
      url: "https://pratik.pa.tel/blog/",
      author,
      publisher: author,
      blogPost: posts.map((post) => ({
        "@type": "BlogPosting",
        headline: post.title,
        description: post.subtitle,
        datePublished: post.dateISO,
        url: `https://pratik.pa.tel/blog/${post.slug}/`,
        image: post.image.startsWith("/")
          ? `https://pratik.pa.tel${post.image}`
          : post.image,
        author,
        keywords: post.tags.join(", "),
      })),
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
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Blog — Pratik Patel"
        description={BLOG_DESCRIPTION}
        canonical="https://pratik.pa.tel/blog"
        ogImage={SITE_CARD.url}
        ogImageAlt="Pratik Patel — CTO & Chief Architect — pratik.pa.tel"
        ogImageWidth={SITE_CARD.width}
        ogImageHeight={SITE_CARD.height}
        jsonLd={blogJsonLd}
      />
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

      <div className="pt-28 pb-24">
        <div className="container">
          <m.div
            initial={entrance({ opacity: 0, y: 20 })}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="font-mono text-xs text-primary/60 tracking-widest block mb-2">
              {'// all posts'}
            </span>
            <h1 className="font-display text-4xl lg:text-6xl font-bold mb-12">
              <span className="text-foreground">Blog</span>{" "}
              <span className="text-accent text-glow-accent">archive</span>
            </h1>
          </m.div>

          <div className="space-y-4">
            {posts.map((post, i) => {
              const thumb = thumbnailFor(post.image);

              return (
                <m.article
                  key={post.slug}
                  initial={entrance({ opacity: 0, y: 20 })}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <Link
                    to={`/blog/${post.slug}/`}
                    className="group block border border-border bg-card hover:border-primary/40 transition-all duration-500 p-6 lg:p-8"
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                      <div className="w-full md:w-32 h-32 md:h-24 border border-border overflow-hidden shrink-0">
                        <img
                          src={thumb?.src ?? post.image}
                          srcSet={thumb?.srcSet}
                          sizes={thumb ? THUMBNAIL_SIZES : undefined}
                          alt={post.title}
                          loading="lazy"
                          width={128}
                          height={96}
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-[10px] text-muted-foreground">{post.date}</span>
                          <span className="text-border">|</span>
                          <span className="font-mono text-[10px] text-muted-foreground">{post.readTime}</span>
                          {post.tags.map((tag) => (
                            <span key={tag} className="font-mono text-[10px] text-primary/60 border border-primary/20 px-2 py-0.5">
                              #{tag}
                            </span>
                          ))}
                        </div>
                        <h2 className="font-display text-xl lg:text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                          {post.title}
                        </h2>
                        <p className="font-mono text-sm text-muted-foreground mt-1">{post.subtitle}</p>
                      </div>
                      <div className="w-10 h-10 border border-border flex items-center justify-center text-muted-foreground group-hover:border-primary group-hover:text-primary transition-all shrink-0">
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                    </div>
                  </Link>
                </m.article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Blog;
