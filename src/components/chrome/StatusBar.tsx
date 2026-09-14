import { Link } from "react-router-dom";
import { useBuildInfo } from "@/hooks/useBuildInfo";
import { useCrtNoise } from "@/hooks/useCrtNoise";
import { chromeAccent, chromeAccentSoft, chromeDot, chromeMeta } from "./chrome-tokens";

/**
 * Quiet secondary meta for the site foot: build sha, truncated newest post,
 * CRT toggle. Rendered inside SiteFooter's <footer> so the page keeps a single
 * contentinfo region. Hidden in print — chrome, not content.
 *
 * No own border or wash; PageShell paints one muted block for the whole foot.
 */
const StatusBar = () => {
  const { shortSha, newestTitle, newestSlug } = useBuildInfo();
  const { storedOn, reduceMotion, toggle } = useCrtNoise();
  const crtOn = storedOn && !reduceMotion;
  const crtLabel = reduceMotion ? "crt: off*" : storedOn ? "crt: on" : "crt: off";
  const newestLabel = newestTitle || newestSlug || "";

  return (
    <div
      aria-label="Build status"
      className={`status-bar flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0 ${chromeMeta} print:hidden`}
    >
      <span className="shrink-0">
        main@
        <span className={chromeAccentSoft}>{shortSha || "…"}</span>
      </span>
      {newestSlug ? (
        <>
          <span aria-hidden="true" className={chromeDot}>
            ·
          </span>
          <span className="min-w-0 inline-flex items-center gap-1">
            <span className="shrink-0">newest:</span>
            <Link
              to={`/blog/${newestSlug}/`}
              title={newestLabel}
              className="inline-flex items-center min-h-6 min-w-0 max-w-[14ch] sm:max-w-[28ch] truncate text-primary/80 hover:text-foreground transition-colors"
            >
              {newestLabel}
            </Link>
          </span>
        </>
      ) : null}
      <span aria-hidden="true" className={chromeDot}>
        ·
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
          "shrink-0 inline-flex items-center min-h-6 px-0.5 transition-colors disabled:opacity-50 disabled:hover:text-muted-foreground " +
          (crtOn
            ? `${chromeAccent} hover:text-foreground`
            : "text-muted-foreground hover:text-primary")
        }
      >
        {crtLabel}
      </button>
    </div>
  );
};

export default StatusBar;
