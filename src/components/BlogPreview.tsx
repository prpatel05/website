import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { m } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { posts } from "@/data/blog-posts/registry";
import { useEntrance, useEntranceGate } from "@/hooks/useEntrance";
import { useParallax } from "@/hooks/useParallax";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import SectionHeader from "./SectionHeader";

const HOME_BLOG_POST_LIMIT = 5;

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

const BlogPreview = () => {
  const { ref, scrollYProgress, sectionOpacity } = useScrollAnimation();
  const previewPosts = posts.slice(0, HOME_BLOG_POST_LIMIT);

  const gridY = useParallax(scrollYProgress, [0, 1], ["0%", "-15%"]);

  return (
    <section ref={ref} id="writing" className="py-16 sm:py-24 lg:py-40 relative overflow-hidden">
      <m.div className="absolute inset-0 grid-bg pointer-events-none opacity-50" style={{ y: gridY }} />
      <m.div className="container relative z-10" style={{ opacity: sectionOpacity }}>
        <SectionHeader label="// section:blog" titleLeft="Recent" titleRight="writes" titleRightClass="text-accent text-glow-accent">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-12">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-6xl font-bold">
              <span className="text-foreground">Recent</span>{" "}
              <span className="text-accent text-glow-accent">writes</span>
            </h2>
            <Link
              to="/blog/"
              className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors mt-4 sm:mt-0 flex items-center gap-1 py-1"
            >
              ls ./posts <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </SectionHeader>

        <div className="space-y-4">
          {previewPosts.map((post, i) => (
            <PreviewCard key={post.slug} index={i}>
              <Link
                to={`/blog/${post.slug}/`}
                className="group block border border-border bg-card hover:border-primary/40 transition-all duration-500 p-6 lg:p-8"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {post.date}
                      </span>
                      <span aria-hidden="true" className="text-border hidden sm:inline">|</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {post.readTime}
                      </span>
                      {post.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="font-mono text-[10px] text-primary/60 border border-primary/20 px-2 py-0.5"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
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
