import { Component, Suspense, type ReactNode, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AnimatePresence, LazyMotion, MotionConfig } from "framer-motion";
import PageTransition from "@/components/PageTransition";
import { MAIN_CONTENT_ID } from "@/lib/skip-target";
import { useFirstLoad } from "@/hooks/useEntrance";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { useRouteFocusReset } from "@/hooks/useRouteFocusReset";
import { useRouteAnnouncement } from "@/hooks/useRouteAnnouncement";
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

/**
 * A clicked link starts at the top of the page. A history traversal does not.
 *
 * Resetting on every pathname change reset it on the two navigations the
 * browser is already handling, and handling better than we can. `history
 * .scrollRestoration` is `"auto"`, so on Back/Forward and on reload the browser
 * restores the offset the reader left, and this effect then threw it away.
 *
 * On reload that is a race the reader can lose. Traced from document start on a
 * post at 1500px: `0 → 1500` at 44ms as the browser restored, `→ 0` at 53ms as
 * this effect fired, `→ 1500` at 105ms as the browser restored again and won.
 * Here that is a 52ms flicker. Let hydration land after the browser's last
 * restore attempt — a slow phone, a cold cache — and the reset is the last
 * writer instead, and a reader who refreshed an article they were halfway
 * through is returned to the title. Both branches showed up in measurement.
 *
 * On Back the effect consistently lost that race rather than won it, so it was
 * not visible there; it is dropped for the same reason regardless.
 *
 * `POP` is exactly the set to leave alone: react-router labels both a
 * Back/Forward traversal and the initial entry a document loads on `POP`, and
 * those are the two cases with a scroll position that predates this render.
 * `PUSH` and `REPLACE` are the ones we own, and they still go to the top.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType === "POP") {
      return;
    }
    window.scrollTo(0, 0);
    // `navigationType` is deliberately not a dependency: it describes how we
    // arrived at `pathname`, so it only carries meaning alongside one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return null;
};

/**
 * The other half: `POP` is the set `ScrollToTop` leaves to the browser, and
 * this is the one traversal the browser cannot get right on its own. See
 * src/hooks/useScrollRestoration.ts.
 */
const ScrollRestoration = () => {
  useScrollRestoration();
  return null;
};

/**
 * The tab order's equivalent of `ScrollToTop`: a client-side navigation should
 * start where a fresh load starts. See src/hooks/useRouteFocusReset.ts.
 */
const RouteFocusReset = () => {
  useRouteFocusReset();
  return null;
};

/**
 * The announcement half of the same job: a client-side navigation should tell a
 * screen reader where it landed, the way a fresh load's title does.
 *
 * Rendered here, outside `<AnimatedRoutes>`, so the region is one persistent
 * node. A live region only announces a mutation of an element that was already
 * present — one that mounts along with the incoming route arrives too late to
 * announce anything, and one that unmounts with the outgoing route takes the
 * pending announcement with it.
 *
 * `aria-atomic` because the whole title is the message: without it a change
 * from one post's title to another is announced as only the words that differ.
 * See src/hooks/useRouteAnnouncement.ts.
 */
const RouteAnnouncer = () => {
  const message = useRouteAnnouncement();
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
};

/* ---------- Routes ---------- */

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
        {/*
          No `/resume` route. public/resume/index.html is the redirect, and on
          GitHub Pages it always wins: /resume 301s to /resume/, which is a real
          file, so a router-side redirect could never run there. It works for
          readers with JS off and for crawlers, which a route cannot.
        */}
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
  import("@/lib/motion-features").then(
    (mod) => {
      markMotionFeaturesReady();
      return mod.default;
    },
    () =>
      /*
       * A chunk that is never coming, said in the one way `LazyMotion` already
       * knows how to hear.
       *
       * It calls this once from a mount effect and attaches no rejection
       * handler of its own, so a hash invalidated by a deploy — or a connection
       * that drops — became an uncaught `Failed to fetch dynamically imported
       * module` that stayed on the page for its whole life. Nothing the reader
       * sees depends on it: `markMotionFeaturesReady` is deliberately not called
       * on this branch, so `useEntrance` goes on suppressing and every route
       * mounts in its final state. But an uncaught error is a false report to
       * whatever reads them next.
       *
       * A promise that never settles is exactly what LazyMotion already handles
       * for a chunk still in flight, and it is the truthful description of one
       * that will not arrive. Resolving an empty bundle instead would set
       * framer's loaded flag and leave `strict` `m` elements with no renderer.
       */
      new Promise<never>(() => {})
  );

const App = () => (
  <HelmetProvider>
    <ErrorBoundary>
      {/*
        `z-[300]`, not the `z-50` this used to carry — which tied with the
        navbar. The nav renders later in the DOM, so an equal z-index meant the
        nav won and the link, the first Tab stop on every page, was painted
        underneath it. Sampled across the focused link's own rect it was the
        topmost paint at 0 of 495 points, on every route and both viewports.

        `/blog/` and all 24 post pages give the nav `bg-background/80
        backdrop-blur-xl` unconditionally, so what the reader got was the link
        smeared through a blurred 80%-opaque bar: focusing it moved the
        strongest pixel on screen by 32/255, against 243/255 once it paints on
        top. On `/` the nav is transparent until `scrollY > 50`, which is why
        this survived — the one place it looked right was the top of the
        homepage. `focus:outline-none` left no ring to fall back on either.
        WCAG 2.2 SC 2.4.11 Focus Not Obscured (Minimum).

        Above the overlays (menu `z-[100]`, terminal `z-[200]`) rather than
        merely above the nav, because the invariant is "visible whenever
        focused" and no ordering below them delivers that. It covers nothing:
        the link is `sr-only` until it takes focus, and both overlays trap
        focus, so it cannot be reached while either is open.
      */}
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[300] focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
      >
        Skip to main content
      </a>
      <BrowserRouter>
        <ScrollToTop />
        <ScrollRestoration />
        <RouteFocusReset />
        <RouteAnnouncer />
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
