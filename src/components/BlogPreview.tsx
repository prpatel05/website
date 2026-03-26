import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { posts } from "@/data/blog-posts";
import { useRef } from "react";

const BlogPreview = () => {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const gridY = useTransform(scrollYProgress, [0, 1], ["0%", "-15%"]);
  const sectionOpacity = useTransform(scrollYProgress, [0, 0.15], [0, 1]);

  return (
    <section ref={sectionRef} id="writing" className="py-16 sm:py-24 lg:py-40 relative overflow-hidden">
      <motion.div className="absolute inset-0 grid-bg pointer-events-none opacity-50" style={{ y: gridY }} />
      <motion.div className="container relative z-10" style={{ opacity: sectionOpacity }}>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="font-mono text-xs text-primary/60 tracking-widest block mb-2">
            {'// section:blog'}
          </span>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-12">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-6xl font-bold">
              <span className="text-foreground">Recent</span>{" "}
              <span className="text-accent text-glow-accent">writes</span>
            </h2>
            <Link
              to="/blog"
              className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors mt-4 sm:mt-0 flex items-center gap-1"
            >
              ls ./posts <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </motion.div>

        <div className="space-y-4">
          {posts.map((post, i) => (
            <motion.div
              key={post.slug}
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                to={`/blog/${post.slug}`}
                className="group block border border-border bg-card hover:border-primary/40 transition-all duration-500 p-6 lg:p-8"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {post.date}
                      </span>
                      <span className="text-border hidden sm:inline">|</span>
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
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default BlogPreview;
