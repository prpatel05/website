import { Component, Suspense, type ReactNode, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AnimatePresence, LazyMotion, MotionConfig } from "framer-motion";
import PageTransition from "@/components/PageTransition";
import { MAIN_CONTENT_ID } from "@/lib/skip-target";
import { useFirstLoad } from "@/hooks/useEntrance";
import { markMotionFeaturesReady } from "@/lib/motion-ready";
import { BlogPostRoute, POST_PATH } from "./routes";
import Index from "./pages/Index.tsx";
import Blog from "./pages/Blog.tsx";
import NotFound from "./pages/NotFound.tsx";

/* ---------- Error Boundary ---------- */

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
            <p className="mt-2 text-muted-foreground">
              Please try{" "}
              <button
                className="underline hover:text-primary"
                onClick={() => window.location.reload()}
              >
                refreshing the page
              </button>.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ---------- Scroll Reset ---------- */

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

/* ---------- Routes ---------- */

const ResumePdfRedirect = () => {
  window.location.replace(`${import.meta.env.BASE_URL}resume.pdf`);
  return null;
};

/**
 * `<Suspense>`, except on the load that hydrates.
 *
 * React 18 claims a Suspense boundary during hydration by looking for the
 * `<!--$-->` / `<!--/$-->` markers `renderToString` writes around it. Our
 * prerendered HTML is a DOM snapshot taken from a live browser, and a
 * client-side render emits no such markers — so a boundary that exists during
 * hydration can never be matched, and React responds by deleting the page and
 * rebuilding it. That is the defect, arriving one layer up from the route.
 *
 * Dropping the boundary is safe precisely on the load where it cannot work:
 * src/main.tsx has already awaited the matched route's chunk before mounting,
 * so nothing under here can suspend. A client-side navigation is the opposite
 * case — the chunk may well be missing and there is no prerendered markup left
 * to protect — so it keeps the boundary.
 */
const RouteBoundary = ({ children }: { children: ReactNode }) =>
  useFirstLoad() ? <>{children}</> : <Suspense fallback={null}>{children}</Suspense>;

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/blog" element={<PageTransition><Blog /></PageTransition>} />
        <Route
          path={POST_PATH}
          element={
            <PageTransition>
              <RouteBoundary>
                <BlogPostRoute />
              </RouteBoundary>
            </PageTransition>
          }
        />
        <Route path="/resume" element={<ResumePdfRedirect />} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

/* ---------- App Shell ---------- */

/**
 * `domAnimation` is the feature set the site actually uses: enter, exit, hover
 * and scroll-linked transforms. The full `motion` component also carries layout
 * projection and drag handling, which nothing here asks for. Pairing `m` with
 * this halves what framer contributes. `strict` turns a stray `motion.*` into a
 * throw rather than a silent import of the full component, which would put the
 * savings back.
 *
 * Loaded as a function rather than a value so it lands in its own chunk instead
 * of the eager preload set. Nothing on the first paint is waiting for it: the
 * prerenderer ships every route fully rendered, and `useEntrance` returns
 * `initial: false` on the document's first load, so elements mount in their
 * final state.
 *
 * A navigation made before the chunk lands is the case that does not take care
 * of itself — `m` would write the incoming route's `initial` into the inline
 * style with no loaded feature able to animate it away, and the reader would
 * wait out the download on a transparent page. Hence the flag: `useEntrance`
 * suppresses the entrance until the features are here, so a slow chunk costs
 * that navigation its animation and nothing else. `e2e/motion-features-late`
 * holds the chunk and asserts it.
 */
const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((mod) => {
    markMotionFeaturesReady();
    return mod.default;
  });

const App = () => (
  <HelmetProvider>
    <ErrorBoundary>
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
      >
        Skip to main content
      </a>
      <BrowserRouter>
        <ScrollToTop />
        {/*
          Deliberately not <main>. This is the router's layout wrapper, so every
          page's <nav> and <footer> render inside it — a <main> here would have
          contained the very blocks the skip link is supposed to jump over, and
          would have stripped <footer> of its implicit contentinfo role. Each
          page owns its own <main> around its actual content instead.
        */}
        <div>
          <LazyMotion features={loadMotionFeatures} strict>
            {/*
              `reducedMotion="user"` drops transform animations — the page
              slide, the drifting background blobs, the 60s rotations — for
              anyone whose OS asks for reduced motion, and keeps the opacity
              ones so nothing goes missing. Scroll-linked offsets are not
              animations and are not covered here; those go through
              `useParallax`.
            */}
            <MotionConfig reducedMotion="user">
              <AnimatedRoutes />
            </MotionConfig>
          </LazyMotion>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  </HelmetProvider>
);

export default App;
