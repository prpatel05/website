import { Link } from "react-router-dom";
import { useBuildInfo } from "@/hooks/useBuildInfo";

/**
 * Sitewide bottom strip. Reads `/build-sha.txt` once after mount (with
 * build-stamp fallback) so paint is never gated on the network. In document
 * flow rather than `fixed`: a fixed translucent bar sat on top of whatever
 * was at the bottom of the viewport and made axe refuse to measure contrast
 * on every content route. Hidden in print — it is chrome, not content.
 */
const StatusBar = () => {
  const { shortSha, deployed, newestTitle, newestSlug } = useBuildInfo();

  return (
    <div
      aria-label="Build status"
      className="border-t border-border bg-background print:hidden"
    >
      <div className="container px-4 min-h-8 py-1 flex items-center gap-x-2 overflow-hidden font-mono text-[10px] text-muted-foreground tracking-wide">
        <span className="shrink-0">main @ {shortSha || "…"}</span>
        {deployed ? (
          <>
            <span aria-hidden="true" className="text-border shrink-0">
              |
            </span>
            <span className="shrink-0">deployed {deployed}</span>
          </>
        ) : null}
        {newestSlug ? (
          <>
            <span aria-hidden="true" className="text-border shrink-0">
              |
            </span>
            <span className="min-w-0 truncate">
              newest:{" "}
              <Link
                to={`/blog/${newestSlug}/`}
                className="inline-flex items-center min-h-6 text-primary hover:text-foreground transition-colors"
              >
                {newestTitle || newestSlug}
              </Link>
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default StatusBar;
