import { Component, type ReactNode, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AnimatePresence } from "framer-motion";
import PageTransition from "@/components/PageTransition";
import Index from "./pages/Index.tsx";
import Blog from "./pages/Blog.tsx";
import BlogPost from "./pages/BlogPost.tsx";
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

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/blog" element={<PageTransition><Blog /></PageTransition>} />
        <Route path="/blog/:slug" element={<PageTransition><BlogPost /></PageTransition>} />
        <Route path="/resume" element={<ResumePdfRedirect />} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

/* ---------- App Shell ---------- */

const App = () => (
  <HelmetProvider>
    <ErrorBoundary>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
      >
        Skip to main content
      </a>
      <BrowserRouter>
        <ScrollToTop />
        <main id="main-content">
          <AnimatedRoutes />
        </main>
      </BrowserRouter>
    </ErrorBoundary>
  </HelmetProvider>
);

export default App;
