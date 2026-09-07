import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { m } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { posts, type BlogPost } from "@/data/blog-posts/registry";
import { resolveSelectedWriting } from "@/data/selected-writing";
import { SERIES_HREF, SERIES_NAME } from "@/lib/blog-series";
import { useEntrance, useEntranceGate } from "@/hooks/useEntrance";
import { useParallax } from "@/hooks/useParallax";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import SectionHeader from "./SectionHeader";

/**
 * One card's entrance, in its own component so it can own its own gate — a
 * hook cannot be called from inside the `map` below.
 */
const PreviewCard = ({ index, children }: { index: number; children: ReactNode }) => {
  const entrance = useEntrance();
  const gate = useEntranceGate();

  return (
    <m.article
      {...gate}
      initial={entrance({ opacity: 0, y: 40, scale: 0.97 })}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      /*
        Positive, not the `-50px` this used to carry. A negative root margin
        makes the observer wait until the card is 50px *inside* the viewport,
        so a card peeking above the bottom edge was on screen and not
        animating — opacity 0 for as long as the reader held still, over a
        strip the whole width of the phone. Firing 50px early is the shape
        that was meant: the entrance is under way by the time the card
        arrives.
      */
      viewport={{ once: true, margin: "50px" }}
      transition={{ duration: 0.6, delay: index * 0.15, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.article>
  );
};

const PostMeta = ({ post, tagLimit = 2 }: { post: BlogPost; tagLimit?: number }) => (
  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
    <span className="font-mono text-[10px] text-muted-foreground">{post.date}</span>
    <span aria-hidden="true" className="text-border hidden sm:inline">
      |
    </span>
    <span className="font-mono text-[10px] text-muted-foreground">{post.readTime}</span>
    {post.tags.slice(0, tagLimit).map((tag) => (
      <span
        key={tag}
        className="font-mono text-[10px] text-primary/60 print:text-primary border border-primary/20 px-2 py-0.5"
      >
        #{tag}
      </span>
    ))}
  </div>
);

const BlogPreview = () => {
  const { ref, scrollYProgress, sectionOpacity } = useScrollAnimation();
  const latest = posts[0];
  const curated = resolveSelectedWriting().filter(
    (post) => !latest || post.slug !== latest.slug
  );
  // Fall back to newest (excluding the featured latest) only if curation
  // somehow resolves empty — the homepage should never ship a blank Selected
  // block. Deduping keeps a slug that is both newest and curated from
  // appearing twice.
  const cards =
    curated.length > 0
      ? curated
      : posts.filter((post) => !latest || post.slug !== latest.slug).slice(0, 3);

  const gridY = useParallax(scrollYProgress, [0, 1], ["0%", "-15%"]);

  return (
    <section ref={ref} id="writing" className="py-16 sm:py-24 lg:py-40 relative overflow-hidden">
      <m.div className="absolute inset-0 grid-bg pointer-events-none opacity-50" style={{ y: gridY }} />
      <m.div className="container relative z-10" style={{ opacity: sectionOpacity }}>
        <SectionHeader
          label="// section:blog"
          titleLeft="Selected"
          titleRight="writing"
          titleRightClass="text-accent text-glow-accent"
        >
          {latest ? (
            <div className="mt-2 mb-12">
              <PreviewCard index={0}>
                <Link
                  to={`/blog/${latest.slug}/`}
                  className="group block border border-primary/40 bg-card hover:border-primary/70 hover:box-glow transition-all duration-500 overflow-hidden"
                  data-latest-post
                >
                  {/*
                    Terminal window chrome — same traffic-light bar voice as
                    About's about.md card, so Latest reads as chrome rather than
                    another Selected row.
                  */}
                  <div className="h-8 bg-muted border-b border-border flex items-center px-4 gap-2">
                    <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                    <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-primary/40" />
                    <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-primary/60" />
                    <span className="font-mono text-[10px] text-primary/70 print:text-primary ml-3 tracking-widest">
                      // latest
                    </span>
                  </div>
                  <div className="p-6 lg:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/*
                      Same wrap rule as the Selected cards and archive (PRA-977):
                      post-derived title/subtitle/tags need `anywhere` inside flex.
                    */}
                    <div className="flex-1 [overflow-wrap:anywhere]">
                      <PostMeta post={latest} tagLimit={3} />
                      <h3 className="font-display text-2xl lg:text-3xl font-bold text-foreground group-hover:text-primary transition-colors">
                        {latest.title}
                      </h3>
                      <p className="font-mono text-sm text-muted-foreground mt-2">
                        {latest.subtitle}
                      </p>
                    </div>
                    <div className="w-10 h-10 border border-primary/40 flex items-center justify-center text-primary group-hover:border-primary group-hover:bg-primary/10 transition-all shrink-0">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              </PreviewCard>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-12 gap-4">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-6xl font-bold">
              <span className="text-foreground">Selected</span>{" "}
              <span className="text-accent text-glow-accent">writing</span>
            </h2>
            <div className="flex flex-col sm:items-end gap-1">
              <Link
                to="/blog/"
                className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 py-1"
              >
                ls ./posts <ArrowUpRight className="w-3 h-3" />
              </Link>
              <Link
                to={SERIES_HREF}
                className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 py-1"
              >
                series/{SERIES_NAME.toLowerCase().replace(/\s+/g, "-")}{" "}
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </SectionHeader>

        <div className="space-y-4">
          {cards.map((post, i) => (
            <PreviewCard key={post.slug} index={i + 1}>
              <Link
                to={`/blog/${post.slug}/`}
                className="group block border border-border bg-card hover:border-primary/30 transition-all duration-500 p-6 lg:p-8"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/*
                    Same rule, same reason as the blog index card (PRA-977):
                    title, subtitle and tags are post-derived, and `anywhere`
                    rather than `break-word` because a flex item only shrinks
                    below its longest word for `anywhere`.

                    This surface hid the defect rather than showing it, which is
                    why it is worth fixing even though nothing looked wrong: the
                    section here is `overflow-hidden`, so an unwrapped title was
                    silently cropped — 741px of text in a 206px box — instead of
                    scrolling the page. No sideways scrollbar ever appeared to
                    report it.
                  */}
                  <div className="flex-1 [overflow-wrap:anywhere]">
                    <PostMeta post={post} />
                    <h3 className="font-display text-xl lg:text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                      {post.title}
                    </h3>
                    <p className="font-mono text-sm text-muted-foreground mt-1">
                      {post.subtitle}
                    </p>
                  </div>
                  <div className="w-10 h-10 border border-border flex items-center justify-center text-muted-foreground group-hover:border-primary group-hover:text-primary group-hover:bg-primary/10 transition-all shrink-0">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            </PreviewCard>
          ))}
        </div>
      </m.div>
    </section>
  );
};

export default BlogPreview;
