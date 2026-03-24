import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const posts = [
  {
    title: "The Power of Saying No",
    subtitle: "And How It Can Save Your Sanity",
    date: "2025.02",
    readTime: "4 min",
    url: "https://pratik.pa.tel/post/the-power-of-saying-no-and-how-it-can-save-your-sanity",
    tags: ["leadership", "career"],
  },
  {
    title: "Own Your Career",
    subtitle: "5 Lessons to Drive Your Promotions",
    date: "2025.02",
    readTime: "6 min",
    url: "https://pratik.pa.tel/post/own-your-career-5-lessons-to-drive-your-promotions",
    tags: ["growth", "engineering"],
  },
];

const BlogPreview = () => {
  return (
    <section id="writing" className="py-24 lg:py-40 relative">
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-50" />
      <div className="container relative z-10">
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
            <h2 className="font-display text-4xl lg:text-6xl font-bold">
              <span className="text-foreground">Recent</span>{" "}
              <span className="text-accent text-glow-accent">writes</span>
            </h2>
            <a
              href="https://pratik.pa.tel/blog"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors mt-4 sm:mt-0 flex items-center gap-1"
            >
              ls ./posts <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </motion.div>

        <div className="space-y-4">
          {posts.map((post, i) => (
            <motion.a
              key={post.title}
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group block border border-border bg-card hover:border-primary/40 hover:box-glow transition-all duration-500 p-6 lg:p-8"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {post.date}
                    </span>
                    <span className="text-border">|</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
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
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BlogPreview;
