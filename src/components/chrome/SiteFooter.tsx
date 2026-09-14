import { Link } from "react-router-dom";
import { SERIES_HREF } from "@/lib/blog-series";
import { chromeLink, chromeMeta } from "./chrome-tokens";
import StatusBar from "./StatusBar";

/**
 * Sitewide compact mono foot. One contentinfo: restrained sitemap row plus a
 * quiet meta line (copyright + build/newest/crt). Shared so blog / series /
 * post / 404 / home / resume / vc do not each invent a footer.
 *
 * RSS stays visible for feed discovery (llms.txt remains in <head>). HTML
 * resume is the footer link; PDF lives on the resume page. Border and muted
 * wash live on PageShell's foot wrapper.
 */
const SiteFooter = () => {
  const year = new Date().getFullYear();

  const links: { to?: string; href?: string; label: string; ariaLabel?: string }[] = [
    { to: "/", label: "home", ariaLabel: "home (sitemap)" },
    { to: "/blog/", label: "blog" },
    { to: SERIES_HREF, label: "series" },
    { to: "/resume/", label: "resume" },
    { to: "/vc/", label: "vc" },
    { href: "/rss.xml", label: "rss" },
  ];

  return (
    <footer className="py-2.5 sm:py-3">
      <div className="container flex flex-col gap-1.5 sm:gap-2">
        <nav aria-label="Sitemap" className="print:hidden">
          <ul className={`flex flex-wrap items-center gap-x-2.5 gap-y-0.5 ${chromeMeta}`}>
            {links.map((item) => (
              <li key={item.label}>
                {item.to ? (
                  <Link
                    to={item.to}
                    className={chromeLink}
                    aria-label={item.ariaLabel}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a href={item.href} className={chromeLink}>
                    {item.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div
          className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 min-w-0 ${chromeMeta}`}
        >
          <span className="shrink-0">© {year} PRATIK PATEL</span>
          <StatusBar />
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
