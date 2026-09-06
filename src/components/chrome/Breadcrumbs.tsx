import { Link } from "react-router-dom";

export type BreadcrumbSegment = {
  /** Path segment as shown after `~/` (e.g. `blog`, a slug). */
  label: string;
  /** Ancestor segments link; the current page omits `to`. */
  to?: string;
};

type BreadcrumbsProps = {
  segments: BreadcrumbSegment[];
};

const segmentClass =
  "inline-flex items-center justify-center min-h-6 min-w-6 px-1 py-1 text-primary hover:text-foreground transition-colors break-all";

/**
 * Terminal-style path for the top bar: `~/blog/<slug>` with each ancestor a
 * link. Replaces the lonely `cd ~` so a reader can still go home and also see
 * where they are. Segments wrap rather than truncate so WCAG 1.4.12 text
 * spacing never clips the path.
 */
const Breadcrumbs = ({ segments }: BreadcrumbsProps) => {
  return (
    <ol className="flex flex-wrap items-center gap-x-0 font-mono text-xs">
      <li className="flex items-center">
        <Link to="/" aria-label="Home" className={segmentClass}>
          ~
        </Link>
      </li>
      {segments.map((segment, i) => {
        const last = i === segments.length - 1;
        return (
          <li key={`${segment.label}-${i}`} className="flex items-center min-w-0">
            <span aria-hidden="true" className="text-muted-foreground px-0.5">
              /
            </span>
            {segment.to && !last ? (
              <Link to={segment.to} className={segmentClass}>
                {segment.label}
              </Link>
            ) : (
              <span
                aria-current={last ? "page" : undefined}
                className="inline-flex items-center min-h-6 px-1 py-1 text-muted-foreground break-all"
              >
                {segment.label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default Breadcrumbs;
