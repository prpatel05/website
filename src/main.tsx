import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAnalytics } from "./lib/analytics";

createRoot(document.getElementById("root")!).render(<App />);

// Load the privacy-friendly Cloudflare Web Analytics beacon (no-op until a
// VITE_CF_BEACON_TOKEN is configured). See PRA-465.
initAnalytics();
