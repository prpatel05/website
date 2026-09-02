import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { markdownHtml } from "./scripts/markdown-html.mjs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    markdownHtml(),
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  build: {
    rollupOptions: {
      output: {
        // framer-motion is deliberately absent. Naming it here forced every
        // one of its modules into a single chunk, which meant the dynamic
        // import in `App.tsx` resolved back into a chunk the entry already
        // pulled in eagerly and the split saved nothing. Left to Rollup, the
        // core that `m` needs stays with the entry and the animation features
        // land in their own async chunk.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
}));
