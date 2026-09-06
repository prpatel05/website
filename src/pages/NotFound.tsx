import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { m } from "framer-motion";
import { posts } from "@/data/blog-posts/registry";
import { SERIES_HREF, SERIES_NAME } from "@/lib/blog-series";
import PageShell from "@/components/chrome/PageShell";
import { useEntrance } from "@/hooks/useEntrance";
import { mainContentProps } from "@/lib/skip-target";
import { NOT_FOUND_TITLE } from "@/lib/route-title";

const linkClass =
  "font-mono text-sm text-primary hover:text-foreground transition-colors inline-flex items-center min-h-6";

const NotFound = () => {
  const entrance = useEntrance();
  const latest = posts[0];

  return (
    <PageShell breadcrumbs={[{ label: "???" }]}>
      {/*
        This page is prerendered to dist/404.html, which GitHub Pages serves —
        with a real 404 status — for every unknown URL. No canonical: pointing
        one at the homepage is the soft-404 signal this change removes.
      */}
      <Helmet>
        <title>{NOT_FOUND_TITLE}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <main
        {...mainContentProps}
        className="min-h-[70vh] flex flex-col items-center justify-center px-4 pt-28 pb-16"
      >
        <m.div
          initial={entrance({ opacity: 0, y: 20 })}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-lg w-full"
        >
          <span className="font-mono text-xs text-primary/60 print:text-primary tracking-widest block mb-4">
            {"// error:404"}
          </span>
          <h1 className="font-display text-6xl lg:text-8xl font-bold text-primary text-glow mb-4">
            404
          </h1>
          <p className="font-mono text-sm text-muted-foreground mb-2">
            command not found: the route you requested is not in $PATH.
          </p>
          <p className="font-mono text-xs text-muted-foreground mb-10">
            Try one of these instead:
          </p>

          <ul className="space-y-3 text-left border border-border bg-card p-5">
            <li>
              <Link
                to="/"
                // Background-only button shape kept for the primary escape hatch:
                // forced colours flatten fills to Canvas, so it needs a real border.
                className="inline-flex items-center gap-2 font-mono text-sm bg-primary text-primary-foreground px-4 py-2.5 hover:bg-primary/90 transition-colors forced-colors:border forced-colors:border-[ButtonText] min-h-6"
              >
                cd ~
              </Link>
              <span className="font-mono text-[10px] text-muted-foreground ml-3">
                home
              </span>
            </li>
            <li>
              <Link to="/blog/" className={linkClass}>
                cd ~/blog
              </Link>
            </li>
            {latest ? (
              <li>
                <Link to={`/blog/${latest.slug}/`} className={linkClass}>
                  open ~/blog/{latest.slug}
                </Link>
                <span className="block font-mono text-[10px] text-muted-foreground mt-1 truncate">
                  latest · {latest.title}
                </span>
              </li>
            ) : null}
            <li>
              <Link to={SERIES_HREF} className={linkClass}>
                cd ~/blog/series/agent-reliability
              </Link>
              <span className="block font-mono text-[10px] text-muted-foreground mt-1">
                series · {SERIES_NAME}
              </span>
            </li>
          </ul>
        </m.div>
      </main>
    </PageShell>
  );
};

export default NotFound;
