import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { posts } from "@/data/blog-posts/registry";
import { postDescription } from "@/lib/post-description";

/**
 * The homepage's path to the newest post. Rendered in the hero so it is on
 * screen at 360x640, not only after a scroll past the min-h-screen fold.
 *
 * Intentionally still: an entrance animation on a first-viewport card would
 * spend a beat at opacity 0 over a large hit target, and would be a CLS risk
 * on the landing surface. The title, date and teaser are already in the
 * prerendered HTML.
 */
const LatestPostCard = () => {
  const latest = posts[0];
  if (!latest) return null;

  const teaser = postDescription(latest);

  // `mr-12` on small screens keeps the right edge clear of the terminal
  // toggle (`fixed bottom-6 right-6 w-12 h-12`), which would otherwise
  // sit on the card's corner at 360x640.
  return (
    <article className="mt-4 sm:mt-6 max-w-xl mr-12 sm:mr-0">
      <Link
        to={`/blog/${latest.slug}/`}
        data-latest-post
        aria-label={`Read the latest post: ${latest.title}`}
        className="group block border border-primary/40 print:border-primary bg-card hover:border-primary/70 hover:box-glow transition-all duration-500 p-3 sm:p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-1 sm:mb-1.5">
          <span className="font-mono text-[10px] text-primary/70 print:text-primary tracking-widest">
            // latest
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            <span>{latest.date}</span>
            <span aria-hidden="true" className="text-border mx-2">
              |
            </span>
            <span>{latest.readTime}</span>
          </span>
        </div>
        {/*
          `font-bold` keeps the title on the preloaded bold face. An h2 at the
          default weight pulls the 400 face onto the critical path; the same
          reason the old sr-only "Latest post" heading in BlogPreview was bold.
          Small-screen type and a two-line clamp keep a long title inside the
          360x640 first viewport. The Dec 8 title wrapped a second line and
          overflowed that budget by 10px at text-lg / leading-snug.
        */}
        <h2 className="font-display text-base sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors [overflow-wrap:anywhere] leading-tight line-clamp-2">
          {latest.title}
        </h2>
        <p className="font-mono text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-1.5 line-clamp-1 [overflow-wrap:anywhere]">
          {teaser}
        </p>
        <span className="mt-2 sm:mt-2.5 inline-flex items-center gap-1 font-mono text-xs text-primary">
          read post <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
        </span>
      </Link>
    </article>
  );
};

export default LatestPostCard;
