import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";

// The post bodies are markdown, but nothing about rendering them needs a
// browser: the element map below is six static className wrappers, no state and
// no handlers. Running react-markdown here instead of in the client keeps its
// remark/rehype pipeline (36KB gzip) out of every post page, which only ever
// re-derived the HTML the prerenderer had already written to disk.
//
// This is deliberately the same renderer the page used to run, not a second
// markdown implementation, so the emitted HTML is identical to what shipped
// before rather than merely similar.
const components = {
  h2: ({ children }) =>
    h(
      "h2",
      {
        className:
          "font-display text-2xl lg:text-3xl font-bold text-foreground mt-12 mb-6 border-l-2 border-primary pl-4",
      },
      children
    ),
  h3: ({ children }) =>
    h(
      "h3",
      { className: "font-display text-xl font-bold text-foreground mt-10 mb-4" },
      children
    ),
  p: ({ children }) =>
    h(
      "p",
      { className: "text-muted-foreground leading-relaxed my-4" },
      children
    ),
  ul: ({ children }) => h("ul", { className: "space-y-2 my-6 ml-4" }, children),
  li: ({ children }) =>
    h(
      "li",
      { className: "flex gap-3 text-muted-foreground leading-relaxed" },
      h("span", { className: "text-primary shrink-0 mt-1.5" }, "▸"),
      h("span", null, children)
    ),
  strong: ({ children }) =>
    h("strong", { className: "text-foreground font-semibold" }, children),
  em: ({ children }) => h("em", { className: "text-primary/80" }, children),
  // Without an entry here a markdown link emits a bare <a>, and Tailwind's
  // preflight resets anchors to `color: inherit; text-decoration: inherit`.
  // That paints the link in the exact colour, weight and decoration as the
  // paragraph around it — indistinguishable from body text unless you happen
  // to hover it. Colour alone would not be enough anyway (WCAG 1.4.1), so the
  // underline is the part doing the real work.
  a: ({ href, children }) =>
    h(
      "a",
      {
        href,
        className:
          "text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary transition-colors",
      },
      children
    ),
};

export const renderMarkdownToHtml = (markdown) =>
  renderToStaticMarkup(h(Markdown, { components }, markdown));

// Vite plugin: `import body from "./content/foo.md"` yields the rendered HTML
// string. Registered for the build and for dev, so the two agree.
export const markdownHtml = () => ({
  name: "markdown-html",
  enforce: "pre",
  transform(code, id) {
    if (!id.endsWith(".md")) return null;
    return {
      code: `export default ${JSON.stringify(renderMarkdownToHtml(code))};`,
      map: null,
    };
  },
});
