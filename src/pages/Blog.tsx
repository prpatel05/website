import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { posts } from "@/data/blog-posts";

const Blog = () => {
  return (
    <div className="min-h-screen bg-background">
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
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
          </motion.div>

          <div className="space-y-4">
            {posts.map((post, i) => (
              <motion.div
                key={post.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <Link
                  to={`/blog/${post.slug}`}
                  className="group block border border-border bg-card hover:border-primary/40 transition-all duration-500 p-6 lg:p-8"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="w-full md:w-32 h-32 md:h-24 border border-border overflow-hidden shrink-0">
                      <img
                        src={post.image}
                        alt={post.title}
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
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Blog;
