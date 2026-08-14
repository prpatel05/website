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
      h("span", null, children)
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
  // config key, a fully-qualified name — pushes the page wider than the
  // viewport. `model_context_window_exceeded` is ~256px at 14px JetBrains Mono
  // with the chip's padding, which clears a 320px paragraph (~288px usable) and
  // overflows an ordered-list item (~232px after the marker and indent). Like
  // `pre`'s tab stop above, whether it bites is a question of rendered width,
  // so an author writing the markdown has no way to see it coming.
  //
  // `anywhere` rather than `break-words`, and the difference is the whole fix.
  // `li` below is a flex row — marker span, content span — so the content is a
  // flex item at `min-width: auto`, whose floor is its min-content width.
  // `overflow-wrap: break-word` adds a break opportunity for line breaking but
  // pointedly does not feed min-content, so that floor stays the full width of
  // the token and the page still overflows: 12px either way, measured. Only
  // `anywhere`'s breaks count toward min-content, which is what lets the flex
  // item shrink. Neither breaks a token that would fit on a line of its own, so
  // the readability cost is paid only where the alternative is a sideways
  // scroll. Arbitrary property because Tailwind 3 has no `anywhere` utility.
  code: ({ children, fenced }) =>
    fenced
      ? h("code", { className: "text-muted-foreground" }, children)
      : h(
          "code",
          {
            className:
              "rounded bg-muted px-1.5 py-0.5 text-foreground [overflow-wrap:anywhere]",
          },
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
