import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { markdownHtml } from "./scripts/markdown-html.mjs";

export default defineConfig({
  // Same .md handling as the app build, so a test importing a post body sees
  // the HTML the browser sees rather than an unparseable module.
  plugins: [markdownHtml(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
