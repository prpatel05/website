import { Link } from "react-router-dom";
import { useBuildInfo } from "@/hooks/useBuildInfo";
import { useCrtNoise } from "@/hooks/useCrtNoise";
import { chromeAccent, chromeAccentSoft, chromeMeta, chromeSep } from "./chrome-tokens";

/**
 * Sitewide bottom strip. Reads `/build-sha.txt` once after mount (with
 * build-stamp fallback) so paint is never gated on the network. In document
 * flow rather than `fixed`: a fixed translucent bar sat on top of whatever
 * was at the bottom of the viewport and made axe refuse to measure contrast
 * on every content route. Hidden in print — it is chrome, not content.
 *
 * Also hosts the CRT noise toggle: off by default, remembered in localStorage,
 * forced off under prefers-reduced-motion.
 *
 * Lives under SiteFooter inside PageShell's single foot border so mobile does
 * not stack two competing `border-t` rules.
 */
const StatusBar = () => {
  const { shortSha, deployed, newestTitle, newestSlug } = useBuildInfo();
  const { storedOn, reduceMotion, toggle } = useCrtNoise();
  const crtOn = storedOn && !reduceMotion;
  const crtLabel = reduceMotion ? "crt: off*" : storedOn ? "crt: on" : "crt: off";

  return (
    <div
      aria-label="Build status"
      className="status-bar bg-muted/25 print:hidden"
    >
      <div
        className={`container min-h-8 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${chromeMeta}`}
      >
        <span className="shrink-0">
          main @{" "}
          <span className={chromeAccentSoft}>{shortSha || "…"}</span>
        </span>
        {deployed ? (
          <>
            <span aria-hidden="true" className={`${chromeSep} shrink-0`}>
              |
            </span>
            <span className="shrink-0">deployed {deployed}</span>
          </>
        ) : null}
        {newestSlug ? (
          <>
            <span aria-hidden="true" className={`${chromeSep} shrink-0`}>
              |
            </span>
            <span className="min-w-0 break-words">
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
        <span aria-hidden="true" className={`${chromeSep} shrink-0`}>
          |
        </span>
        <button
          type="button"
          onClick={toggle}
          disabled={reduceMotion}
          aria-pressed={crtOn}
          aria-label={
            reduceMotion
              ? "CRT noise unavailable with reduced motion"
              : storedOn
                ? "Turn CRT noise off"
                : "Turn CRT noise on"
          }
          title={
            reduceMotion
              ? "CRT noise stays off while prefers-reduced-motion is set"
              : "Toggle subtle CRT noise / scanlines"
          }
          className={
            "shrink-0 inline-flex items-center min-h-6 px-1 transition-colors disabled:opacity-50 disabled:hover:text-muted-foreground " +
            (crtOn
              ? `${chromeAccent} hover:text-foreground`
              : "text-muted-foreground hover:text-primary")
          }
        >
          {crtLabel}
        </button>
      </div>
    </div>
  );
};

export default StatusBar;
