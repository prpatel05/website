import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAnalytics } from "./lib/analytics";
import { initTrafficPixel } from "./lib/traffic-pixel";

createRoot(document.getElementById("root")!).render(<App />);

// Load the privacy-friendly Cloudflare Web Analytics beacon (no-op until a
// VITE_CF_BEACON_TOKEN is configured). See PRA-465.
initAnalytics();

// Fallback traffic instrument: a cookieless Bounded edge pixel reporting
// referrer-segmented event counts. Stands down automatically if the Cloudflare
// beacon above is ever provisioned — never both. See PRA-503.
initTrafficPixel();
