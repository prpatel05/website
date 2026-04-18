import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { posts } from "@/data/blog-posts";

const NotFound = () => {
  const recentPosts = posts.slice(0, 3);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-lg"
      >
        <span className="font-mono text-xs text-primary/60 tracking-widest block mb-4">
          {"// error:404"}
        </span>
        <h1 className="font-display text-6xl lg:text-8xl font-bold text-primary text-glow mb-4">
          404
        </h1>
        <p className="font-mono text-sm text-muted-foreground mb-8">
          Page not found. The route you requested doesn't exist.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-mono text-sm bg-primary text-primary-foreground px-6 py-3 hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          cd ~
        </Link>
      </motion.div>

      {recentPosts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-16 max-w-lg w-full"
        >
          <h2 className="font-mono text-xs text-muted-foreground mb-4 text-center">
            Recent posts you might enjoy:
          </h2>
          <div className="space-y-2">
            {recentPosts.map((post) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="group block border border-border bg-card hover:border-primary/40 transition-all duration-300 p-4"
              >
                <span className="font-mono text-[10px] text-muted-foreground block mb-1">
                  {post.date}
                </span>
                <span className="font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {post.title}
                </span>
              </Link>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default NotFound;
