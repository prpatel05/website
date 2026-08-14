import { Children, cloneElement, createElement as h, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";

// react-markdown v10 hands a component only `node` and `children`; the
// `ordered`/`index`/`inline` props older versions passed are gone. So a `li`
// cannot tell whether it sits in a `ul` or an `ol`, and a `code` cannot tell an
// inline span from a fenced block. The parent knows both, and `children` here
// is the still-unrendered element array, so it can pass the answer down as an
// ordinary prop — no context and no mutation during render.
const withProps = (children, propsFor) =>
  Children.map(children, (child) =>
    isValidElement(child) ? cloneElement(child, propsFor()) : child
  );

// The post bodies are markdown, but nothing about rendering them needs a
// browser: the element map below is static className wrappers, no state and no
// handlers. Running react-markdown here instead of in the client keeps its
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
  // An `ol` with no entry here renders as an unordered list: preflight strips
  // `list-style` and the padding that would hang a number, and the shared `li`
  // below then paints the same `▸` a bullet list gets. Both posts that number
  // their steps are *about* the sequence, so the ordinals are the content. They
  // are passed to `li` rather than left to `::marker`, which `display: flex`
  // suppresses — the flex row is what gives every list item its hanging indent.
  ol: ({ children, node }) => {
    let ordinal = Number(node?.properties?.start ?? 1);
    return h(
      "ol",
      { className: "space-y-2 my-6 ml-4" },
      withProps(children, () => ({ ordinal: ordinal++ }))
    );
  },
  // `min-w-0` on the content span is the structural half of the 320px reflow
  // fix whose other half is the `overflow-wrap: anywhere` BlogPost sets on the
  // body. The span is a flex item, so it defaults to `min-width: auto` and
  // cannot shrink below its min-content width. For text that inherited
  // `anywhere` is enough — its break opportunities feed min-content. For a
  // child that has no break opportunities at all it is not: a fenced block
  // nested in a list item is `white-space: pre`, so its min-content is its
  // longest line however the body wraps, and the item drags the page out with
  // it. Measured at 320px: 471px of page overflow, unchanged by `anywhere`, and
  // 0 with this — at which point the block finally uses the `overflow-x-auto`
  // scroller `pre` below already gives it. No post nests a fence in a list
  // today, which is exactly why it is worth pinning: the failure would arrive
  // with the markdown, not with a code change.
  li: ({ children, ordinal }) =>
    h(
      "li",
      { className: "flex gap-3 text-muted-foreground leading-relaxed" },
      ordinal === undefined
        ? h("span", { className: "text-primary shrink-0 mt-1.5" }, "▸")
        : h(
            "span",
            { className: "text-primary shrink-0 tabular-nums" },
            `${ordinal}.`
          ),
      h("span", { className: "min-w-0" }, children)
    ),
  // Preflight zeroes a blockquote's margin, and the `p` inside it is the same
  // component as any body paragraph — so without this a quotation is identical
  // to the author's own prose down to the pixel. The rule and the indent echo
  // the `h2` above rather than introducing a second vocabulary.
  blockquote: ({ children }) =>
    h(
      "blockquote",
      { className: "my-6 border-l-2 border-primary/40 pl-6" },
      children
    ),
  // The body font is already JetBrains Mono, so `code`'s one inherited default
  // buys nothing — family, size and colour all match the prose around it. The
  // chip below is what makes it read as code, which in turn is why `pre` needs
  // an entry: a fenced block must not inherit the inline treatment.
  //
  // `overflow-x-auto` is what makes the block safe to overflow, and also what
  // makes it a scrollable region — one a keyboard user could neither reach nor
  // pan, which is WCAG 2.1.1. Whether it bites depends on rendered width rather
  // than on anything visible in the markdown: a shell command fits at 1280px
  // and scrolls at 393px, so an author drafting a post has no way to see the
  // constraint. `tabIndex` is the fix, unconditionally — the body is static
  // HTML built ahead of any viewport, so there is nothing to measure at render
  // time, and a tab stop on a block that happens not to scroll costs a keypress
  // where the alternative costs a phone reader the content.
  //
  // The role is what makes the stop worth landing on. `aria-label` on a bare
  // `pre` is dropped (implicit role `generic` takes no name), so without
  // `group` a keyboard user tabs into an unannounced box.
  pre: ({ children }) =>
    h(
      "pre",
      {
        className:
          "my-6 overflow-x-auto rounded-lg border border-border bg-card p-4",
        tabIndex: 0,
        role: "group",
        "aria-label": "Code sample",
      },
      withProps(children, () => ({ fenced: true }))
    ),
  // A fenced block can overflow into its own scroller. An inline span cannot:
  // it has nowhere to put the excess, so a single long token — an error code, a
  // config key, a fully-qualified name — would push the page wider than the
  // viewport. That is no longer this mapping's problem: `overflow-wrap:
  // anywhere` on the body wrapper in BlogPost is inherited, and covers a token
  // in a code chip exactly as it covers one in the prose around it. This entry
  // carried its own copy of the rule for one commit (PRA-962, which scoped the
  // failure to inline code); PRA-963 found the same overflow in plain
  // paragraphs, links, list items and headings, so the rule moved up to the one
  // place that reaches all of them rather than being pasted into five. What is
  // left here is the chip described above.
  code: ({ children, fenced }) =>
    fenced
      ? h("code", { className: "text-muted-foreground" }, children)
      : h(
          "code",
          { className: "rounded bg-muted px-1.5 py-0.5 text-foreground" },
          children
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
