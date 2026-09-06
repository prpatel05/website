import { Link } from "react-router-dom";
import { SERIES_HREF, SERIES_NAME } from "@/lib/blog-series";

const linkClass =
  "text-muted-foreground hover:text-primary transition-colors inline-flex items-center justify-center min-h-6 min-w-6 px-1.5";

/**
 * Sitewide tiny mono sitemap. Shared so blog / series / post / 404 / home /
 * resume do not each invent a footer. RSS and llms.txt are visible here — not
 * only in `<head>` — so a reader (or an agent) can find them without viewing
 * source. The HTML resume is the primary link; the PDF stays as a secondary
 * download.
 */
const SiteFooter = () => {
  const year = new Date().getFullYear();
  const resumePdfHref = `${import.meta.env.BASE_URL}resume.pdf`;

  return (
    <footer className="border-t border-border py-6">
      <div className="container px-4 flex flex-col gap-3">
        <nav aria-label="Sitemap" className="print:hidden">
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-widest">
            <li>
              <Link to="/" className={linkClass} aria-label="home (sitemap)">
                home
              </Link>
            </li>
            <li aria-hidden="true" className="text-border">
              |
            </li>
            <li>
              <Link to="/blog/" className={linkClass}>
                blog
              </Link>
            </li>
            <li aria-hidden="true" className="text-border">
              |
            </li>
            <li>
              <Link to={SERIES_HREF} className={linkClass}>
                series ({SERIES_NAME})
              </Link>
            </li>
            <li aria-hidden="true" className="text-border">
              |
            </li>
            <li>
              <a href="/rss.xml" className={linkClass}>
                rss
              </a>
            </li>
            <li aria-hidden="true" className="text-border">
              |
            </li>
            <li>
              <a href="/llms.txt" className={linkClass}>
                llms.txt
              </a>
            </li>
            <li aria-hidden="true" className="text-border">
              |
            </li>
            <li>
              <Link to="/resume/" className={linkClass}>
                resume
              </Link>
            </li>
            <li aria-hidden="true" className="text-border">
              |
            </li>
            <li>
              <a
                href={resumePdfHref}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                resume.pdf
              </a>
            </li>
          </ul>
        </nav>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground tracking-widest">
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
