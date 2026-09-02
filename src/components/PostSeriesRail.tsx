import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { SeriesPosition } from "@/lib/blog-series";
import { SERIES_HREF } from "@/lib/blog-series";
import { cn } from "@/lib/utils";

type PostSeriesRailProps = {
  position: SeriesPosition | null;
  className?: string;
  /** Distinguishes the two instances so print and e2e can name one. */
  placement?: "top" | "footer";
};

const cellLink =
  "group flex min-h-6 items-start gap-2 py-1 text-muted-foreground transition-colors hover:text-foreground";

/**
 * Compact series pager for posts in the agent-reliability arc.
 *
 * Same component at the top of a member post (under the hero) and again above
 * the site-wide newer/older cards. Membership and order live in
 * `blog-series.ts`; this file only paints a position. A non-member passes
 * `null` and gets nothing — including no hollow `// series`.
 *
 * Current is a marked span, not a self-link. Neighbours are the previous and
 * next members in reading order, not the archive neighbours. Hidden in print
 * on the footer instance (the page passes `print:hidden`); the top instance
 * stays so a printed post still says which chapter it is.
 */
const PostSeriesRail = ({ position, className, placement }: PostSeriesRailProps) => {
  if (!position) return null;

  const { name, current, previous, next, index, total } = position;

  return (
    <nav
      aria-label={name}
      data-series-rail={placement ?? ""}
      className={cn("font-mono text-xs", className)}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="tracking-widest text-primary/60 print:text-primary">
          {"// series"}
        </p>
        <p className="text-muted-foreground">
          <Link
            to={SERIES_HREF}
            className="inline-flex items-center min-h-6 text-foreground transition-colors hover:text-primary"
          >
            {name}
          </Link>
          <span aria-hidden="true" className="mx-2 text-border">
            |
          </span>
          <span>
            {index} of {total}
          </span>
        </p>
      </div>
      <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
        <div>
          {previous ? (
            <Link to={`/blog/${previous.slug}/`} className={cellLink}>
              <ArrowLeft className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>
                <span className="block text-[10px] tracking-widest">previous</span>
                <span className="block text-foreground group-hover:text-primary">
                  {previous.title}
                </span>
              </span>
            </Link>
          ) : null}
        </div>
        <div className="sm:text-center">
          <p
            aria-current="page"
            className="min-h-6 py-1 text-primary"
          >
            <span className="block text-[10px] tracking-widest">current</span>
            <span className="block">{current.title}</span>
          </p>
        </div>
        <div className="sm:text-right">
          {next ? (
            <Link
              to={`/blog/${next.slug}/`}
              className={cn(cellLink, "sm:justify-end")}
            >
              <span>
                <span className="block text-[10px] tracking-widest">next</span>
                <span className="block text-foreground group-hover:text-primary">
                  {next.title}
                </span>
              </span>
              <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
    </nav>
  );
};

export default PostSeriesRail;
