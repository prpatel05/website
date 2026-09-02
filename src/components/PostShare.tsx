import { useEffect, useRef, useState } from "react";
import { socials } from "@/data/socials";
import {
  RSS_URL,
  linkedInShareUrl,
  postCanonicalUrl,
  xShareUrl,
} from "@/lib/share-urls";

const COPY_RESET_MS = 2000;

const substackUrl = socials.find((s) => s.name === "Substack")?.url;

type PostShareProps = {
  slug: string;
  title: string;
};

const linkClass =
  "flex min-h-6 min-w-6 items-center gap-2 py-1 text-muted-foreground transition-colors hover:text-foreground";

const Bullet = () => (
  <span aria-hidden="true" className="text-primary">
    {"▸"}
  </span>
);

/**
 * End-of-post share + subscribe row.
 *
 * Copy writes the canonical production URL, not `window.location` — a preview
 * origin or a slashless path is the wrong thing to hand a reader. X and
 * LinkedIn are GET intent URLs in a new tab, not SDKs. RSS and Substack are
 * subscribe exits; Substack's href is looked up from `socials` so it cannot
 * drift from the Connect grid.
 *
 * Hidden in print: none of these controls do anything on paper, and a row of
 * dead links on every sheet is the same defect the navbar already had.
 * Starts with `copied === false` on both the prerender and the hydrating
 * client so the first paint cannot disagree.
 */
const PostShare = ({ slug, title }: PostShareProps) => {
  const url = postCanonicalUrl(slug);
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return;
    }
    setCopied(true);
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      setCopied(false);
      resetTimer.current = null;
    }, COPY_RESET_MS);
  };

  return (
    <div className="mb-8 font-mono text-xs print:hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 tracking-widest text-primary/60 print:text-primary">{"// share"}</p>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <li>
              <button type="button" onClick={copy} className={linkClass}>
                <Bullet />
                {copied ? "copied" : "copy url"}
              </button>
              <span className="sr-only" aria-live="polite">
                {copied ? "copied" : ""}
              </span>
            </li>
            <li>
              <a
                href={xShareUrl(url, title)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="share on x"
                className={linkClass}
              >
                <Bullet />
                x
              </a>
            </li>
            <li>
              <a
                href={linkedInShareUrl(url)}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                <Bullet />
                linkedin
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-2 tracking-widest text-primary/60 print:text-primary sm:text-right">
            {"// subscribe"}
          </p>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:justify-end">
            <li>
              <a href={RSS_URL} className={linkClass}>
                <Bullet />
                rss
              </a>
            </li>
            {substackUrl ? (
              <li>
                <a
                  href={substackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  <Bullet />
                  substack
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PostShare;
