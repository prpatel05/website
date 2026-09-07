import { Link } from "react-router-dom";
import { SERIES_HREF, SERIES_NAME } from "@/lib/blog-series";
import { chromeLink, chromeMeta, chromeSep } from "./chrome-tokens";

/**
 * Sitewide tiny mono sitemap. Shared so blog / series / post / 404 / home /
 * resume do not each invent a footer. RSS and llms.txt are visible here — not
 * only in `<head>` — so a reader (or an agent) can find them without viewing
 * source. The HTML resume is the primary link; the PDF stays as a secondary
 * download.
 *
 * Border lives on PageShell's foot wrapper with StatusBar so the two strips
 * share one rule instead of fighting on mobile.
 */
const SiteFooter = () => {
  const year = new Date().getFullYear();
  const resumePdfHref = `${import.meta.env.BASE_URL}resume.pdf`;

  return (
    <footer className="pt-5 pb-3 sm:pt-6 sm:pb-4">
      <div className="container flex flex-col gap-2.5">
        <nav aria-label="Sitemap" className="print:hidden">
          <ul className={`flex flex-wrap items-center gap-x-1 gap-y-1 ${chromeMeta}`}>
            <li>
              <Link to="/" className={chromeLink} aria-label="home (sitemap)">
                home
              </Link>
            </li>
            <li aria-hidden="true" className={chromeSep}>
              |
            </li>
            <li>
              <Link to="/blog/" className={chromeLink}>
                blog
              </Link>
            </li>
            <li aria-hidden="true" className={chromeSep}>
              |
            </li>
            <li>
              <Link to={SERIES_HREF} className={chromeLink}>
                series ({SERIES_NAME})
              </Link>
            </li>
            <li aria-hidden="true" className={chromeSep}>
              |
            </li>
            <li>
              <a href="/rss.xml" className={chromeLink}>
                rss
              </a>
            </li>
            <li aria-hidden="true" className={chromeSep}>
              |
            </li>
            <li>
              <a href="/llms.txt" className={chromeLink}>
                llms.txt
              </a>
            </li>
            <li aria-hidden="true" className={chromeSep}>
              |
            </li>
            <li>
              <Link to="/resume/" className={chromeLink}>
                resume
              </Link>
            </li>
            <li aria-hidden="true" className={chromeSep}>
              |
            </li>
            <li>
              <a
                href={resumePdfHref}
                target="_blank"
                rel="noopener noreferrer"
                className={chromeLink}
              >
                resume.pdf
              </a>
            </li>
          </ul>
        </nav>
        <div
          className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 ${chromeMeta}`}
        >
          <span>© {year} PRATIK PATEL</span>
          <span className="text-primary/60 print:text-primary">
            BUILT WITH PURPOSE // v3.0
          </span>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
