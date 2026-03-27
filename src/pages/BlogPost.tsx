import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import { getPostBySlug } from "@/data/blog-posts";
import NotFound from "./NotFound";
import SEO from "@/components/SEO";

const renderMarkdown = (content: string) => {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let i = 0;
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="space-y-2 my-6 ml-4">
          {listItems.map((item, idx) => (
            <li key={idx} className="flex gap-3 text-muted-foreground leading-relaxed">
              <span className="text-primary shrink-0 mt-1.5">▸</span>
              <span dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const inlineFormat = (text: string): string => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
      .replace(/_(.+?)_/g, '<em class="text-primary/80">$1</em>');
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      flushList();
      const text = line.replace(/^### \d*\.?\s*/, "").replace(/\*\*/g, "");
      elements.push(
        <h3 key={i} className="font-display text-xl font-bold text-foreground mt-10 mb-4">
          {text}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      flushList();
      const text = line.replace(/^## \d*\.?\s*/, "").replace(/\*\*/g, "");
      elements.push(
        <h2 key={i} className="font-display text-2xl lg:text-3xl font-bold text-foreground mt-12 mb-6 border-l-2 border-primary pl-4">
          {text}
        </h2>
      );
    } else if (line.startsWith("- ")) {
      const item = line.replace(/^- /, "");
      listItems.push(item);
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      elements.push(
        <p
          key={i}
          className="text-muted-foreground leading-relaxed my-4"
          dangerouslySetInnerHTML={{ __html: inlineFormat(line) }}
        />
      );
    }

    i++;
  }

  flushList();
  return elements;
};

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;

  if (!post) return <NotFound />;

  const ogImage = post.image.startsWith("/")
    ? `https://pratik.pa.tel${post.image}`
    : post.image;

  const blogPostJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.subtitle,
    datePublished: post.dateISO,
    image: ogImage,
    url: `https://pratik.pa.tel/blog/${post.slug}`,
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
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${post.title} — Pratik Patel`}
        description={post.subtitle}
        canonical={`https://pratik.pa.tel/blog/${post.slug}`}
        ogImage={ogImage}
        ogType="article"
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
            <img
              src={post.image}
              alt={post.title}
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
            {renderMarkdown(post.content)}
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-16 pt-8 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <Link
              to="/#writing"
              className="font-mono text-xs text-primary hover:text-foreground transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              ls ../posts
            </Link>
            <span className="font-mono text-[10px] text-muted-foreground">
              © {new Date().getFullYear()} PRATIK PATEL
            </span>
          </motion.div>
        </div>
      </article>
    </div>
  );
};

export default BlogPost;
