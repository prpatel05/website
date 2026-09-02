import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App.tsx";
import { preloadRoute } from "./routes";
import "./index.css";
import { initAnalytics } from "./lib/analytics";

const container = document.getElementById("root")!;

/**
 * The build prerenders every route into `<div id="root">`, so on a real visit
 * that container arrives already full. `createRoot` on a non-empty container
 * throws those children away and rebuilds from scratch: the reader watched a
 * painted, readable article go blank for ~200ms while React re-created the
 * markup that was already on screen. `hydrateRoot` adopts it instead.
 *
 * The empty case is not hypothetical — `vite dev` serves index.html untouched —
 * and hydrating an empty container would mismatch on every node. Branch on what
 * is actually in the DOM rather than on the build mode, so the two cannot
 * disagree.
 */
const mount = () => {
  if (container.firstElementChild) {
    hydrateRoot(container, <App />);
  } else {
    createRoot(container).render(<App />);
  }
};

// Hydration has to be able to render the matched route synchronously. A route
// that suspends while hydrating has no dehydrated boundary to fall back on —
// the prerendered HTML is a DOM snapshot, not `renderToString` output — so
// React would discard the subtree we are here to keep. Waiting for the route's
// chunk costs nothing visible: the page is painted and static until React
// arrives either way. `.then(mount, mount)` because a failed import still needs
// to mount, so the ErrorBoundary can show the reader something.
preloadRoute(window.location.pathname).then(mount, mount);

// Load the privacy-friendly Cloudflare Web Analytics beacon (no-op until a
// VITE_CF_BEACON_TOKEN is configured). See PRA-465.
initAnalytics();
