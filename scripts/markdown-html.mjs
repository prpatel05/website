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
// Every heading level renders through here, which is what keeps the set closed.
// A level with no entry in `components` does not fall back to something plain —
// it emits a bare tag, and two rules then meet: `src/index.css` puts every
// `h1..h6` in `var(--font-display)`, while Tailwind's preflight sets
// `h1..h6 { font-size: inherit; font-weight: inherit }`. So an unmapped heading
// took Space Grotesk at weight 400 by inheritance from the body, and `fonts.css`
// declares exactly one Space Grotesk face: 700 normal. Measured on `2f2bc06`,
// `#### Heading` painted `Space Grotesk|400|normal` — undeclared, so the browser
// snapped or synthesized — at `font-size: 14px` with `margin: 0`, i.e. the body's
// own metrics. The heading was therefore invisible *as* a heading and wrong in
// the face at the same time, with no emphasis involved and nothing going red
// (PRA-1005). `e2e/post-emphasis-faces.spec.ts` now drives all six levels.
//
// `className` is spelled out per level rather than composed from a scale array
// because Tailwind's scanner reads this file as text: a class assembled at
// runtime (`text-${size}`) is never emitted into the stylesheet, and the markup
// would reference a rule that does not exist.
const heading = (tag, className) => ({ children }) =>
  h(
    tag,
    { className },
    // `inHeading` tells the emphasis mappings below that they are painting on
    // Space Grotesk 700 — the only display face declared — so a `strong` here
    // must match that weight rather than hard-set its own. See the `strong`
    // comment for why this is a prop and not a descendant selector. Every level
    // below is `font-display font-bold`, so every level needs this: without it
    // `#### Heading with **bold**` resolves `strong`'s prose weight of 600
    // against the display family and lands on `Space Grotesk|600|normal`, which
    // is the PRA-1004 defect reintroduced one level down.
    withProps(children, () => ({ inHeading: true }))
  );

const H2_CLASS =
  "font-display text-2xl lg:text-3xl font-bold text-foreground mt-12 mb-6 border-l-2 border-primary pl-4";

const components = {
  // A post page spends its `<h1>` on the title (`src/pages/BlogPost.tsx`), which
  // renders above and outside this body. A `#` in the markdown is the author
  // asking for the top *body* level, and on this page that level is `h2` — so
  // this emits an `h2` element rather than a second `h1`, and gets the `h2`
  // styling with it. Rendering the `h1` tag would leave the document with two
  // level-1 headings, which is what a screen-reader user navigating by level
  // actually hears; the visual result is identical either way.
  //
  // Only `h1` is renumbered. Shifting the whole scale down would renumber the
  // 190 `##`/`###` headings the 24 existing posts already use and break the
  // outline they have; the author's *relative* levels are the part worth
  // preserving, and `h1` is special only because the page has already spent it.
  h1: heading("h2", H2_CLASS),
  h2: heading("h2", H2_CLASS),
  h3: heading(
    "h3",
    "font-display text-xl font-bold text-foreground mt-10 mb-4"
  ),
  // `h4`-`h6` continue the ramp down from `h3`'s `text-xl`, in the same
  // vocabulary — display face, bold, `text-foreground` — with the top margin
  // shrinking alongside it so a deep subsection does not open as much space as a
  // section. `h6` lands on `text-sm`, the body's own size: the size axis runs
  // out before the levels do, and family (Space Grotesk against the body's
  // JetBrains Mono), weight and colour still separate it from the prose. Going
  // smaller than the body text to buy one more step would make the deepest
  // heading the least legible thing on the page.
  h4: heading("h4", "font-display text-lg font-bold text-foreground mt-8 mb-3"),
  h5: heading(
    "h5",
    "font-display text-base font-bold text-foreground mt-6 mb-2"
  ),
  h6: heading("h6", "font-display text-sm font-bold text-foreground mt-4 mb-2"),
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
  //
  // Which is exactly why the rule has to survive paper. `print:border-primary`
  // drops the alpha for the same reason `print:text-primary` does on `em`
  // below: an alpha modifier composites toward the *paper*, not the token, so
  // the 40% form landed at 1.95:1 under the print `--primary` — a rule the
  // reader cannot see, on the one element whose entire meaning is that rule
  // (PRA-1073).
  blockquote: ({ children }) =>
    h(
      "blockquote",
      { className: "my-6 border-l-2 border-primary/40 print:border-primary pl-6" },
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
  //
  // And the chip is a *fill*, which is the one cue paper does not carry.
  // `src/index.css` flips `--muted` to white in print on purpose — "there are
  // no filled surfaces on paper" — and Chrome drops backgrounds anyway unless
  // the reader ticks "Background graphics". Both halves of the chip go with it:
  // the fill becomes the paper (1.00:1) and the saturated mint `--foreground`
  // becomes the same achromatic ink as everything else, leaving a 1.75:1 step
  // between two greys as the only thing separating a field name from an English
  // word. Measured on `/blog/the-handoff-is-where-agents-break/`, where
  // `constraints` and `unresolved` are field names and print as prose
  // (PRA-1086).
  //
  // So the chip opts into the substitute `pre` already has, for the identical
  // reason `pre` has it: once the fill drops, a hairline is the only thing left
  // saying "code" rather than "prose". `border-border` is the same token and
  // the same 3.19:1 that `pre`'s hairline prints at since PRA-1073. The other
  // route the print block names — opting the fill in with `print-color-adjust`
  // and owning a foreground for it — is declined deliberately: it spends toner
  // and argues with a site-wide decision to settle one inline element, where
  // the edge agrees with it.
  //
  // Print-only. On screen the fill is present, saturated and doing the work, so
  // an edge there would be a second cue for something already unambiguous.
  code: ({ children, fenced }) =>
    fenced
      ? h("code", { className: "text-muted-foreground" }, children)
      : h(
          "code",
          {
            className:
              "rounded bg-muted px-1.5 py-0.5 text-foreground print:border print:border-border",
          },
          children
        ),
  // Emphasis has to land on a face `src/styles/fonts.css` actually declares,
  // and the declared set is narrow enough that the naive mappings could not:
  // four JetBrains Mono faces (400 normal, 400 italic, 600 normal, 700 normal)
  // and exactly one Space Grotesk — 700 normal. A heading is `font-display` at
  // `font-bold`, so it is already *on* the only display face there is, and any
  // emphasis that moved its weight or its style fell off the set. The browser
  // then snaps to a neighbouring weight or synthesizes an oblique, and the type
  // degrades with nothing going red (PRA-1004). `e2e/post-emphasis-faces.spec.ts`
  // is the gate; the four originally-measured failures are listed there.
  //
  // Declaring the missing faces is the obvious fix and it is blocked: the same
  // spec family asserts every *declared* face is painted somewhere, because an
  // unpainted declaration is the 30KB defect `e2e/font-faces.spec.ts` exists to
  // prevent. So the renderer is what gives.
  //
  // The context is threaded as props rather than expressed as descendant
  // selectors on the heading (`[&_strong]:font-bold`) on purpose. Two such
  // rules — the heading's and `em`'s — would both match a `strong` inside an
  // `em` inside a heading at identical specificity, leaving the winner to
  // Tailwind's emission order, which puts `font-normal` before `font-bold` and
  // would have resolved that case to an undeclared Space Grotesk 700 italic.
  // `withProps` is already how this file tells a child what its parent knows.
  //
  // `strong` keeps 600 in ordinary prose: that mapping is the only thing in the
  // whole product painting `JetBrains Mono|600|normal`, so dropping it would
  // orphan a declared face and fail the parity check from the other direction.
  strong: ({ children, inHeading, inEm }) =>
    h(
      "strong",
      {
        // Inside an `em` the weight has to be 400: italic is declared at 400
        // only, so bolding it lands on an italic face that does not exist.
        // `font-normal` is stated rather than left to inherit from the `em`,
        // because omitting it does not inherit — Tailwind's preflight sets
        // `b, strong { font-weight: bolder }`, which resolves against the
        // parent and computed to 700 here, i.e. straight back onto an
        // undeclared `JetBrains Mono|700|italic`. Measured; it is the same
        // `bolder` behaviour `e2e/font-faces.spec.ts` warns about in its header.
        //
        // In a heading the weight axis is used up — matching the heading's 700
        // is the only declared option — so the emphasis has to be carried by
        // colour or not at all. Not at all is the wrong answer: it renders
        // `**bold**` identically to the words around it, which silently
        // discards what the author wrote. `text-primary` is the vocabulary `em`
        // below already uses for emphasis, not a new one.
        className: inEm
          ? "text-foreground font-normal"
          : inHeading
            ? "text-primary font-bold"
            : "text-foreground font-semibold",
      },
      children
    ),
  // `font-mono font-normal` pins emphasis to `JetBrains Mono|400|italic`, the
  // one italic face that exists. In prose both are no-ops — the body is already
  // mono at 400 — and in a heading they are the whole point: without them the
  // heading's Space Grotesk 700 inherits into the `em` and the browser
  // synthesizes an oblique of a family that ships none.
  //
  // The visible cost is a mixed-family heading, and it is the honest one. There
  // is no Space Grotesk italic to reach for, so the alternatives were mono
  // italic or silently discarding the author's emphasis; this keeps the
  // emphasis, in the family the rest of the site is set in.
  //
  // `print:text-primary` drops the alpha on paper. The `@media print` block in
  // `src/index.css` re-declares `--primary` dark, but an alpha modifier
  // composites toward the *paper*, not the token: at the print `--primary` the
  // 80% form lands at 4.46:1, just under AA, and clearing 4.5:1 through the
  // token alone would need a lightness of 6% — near-black, which would take
  // every link and heading rule with it. So the alpha goes instead (PRA-1063).
  em: ({ children }) =>
    h(
      "em",
      { className: "font-mono font-normal text-primary/80 print:text-primary" },
      withProps(children, () => ({ inEm: true }))
    ),
  // Without an entry here a markdown link emits a bare <a>, and Tailwind's
  // preflight resets anchors to `color: inherit; text-decoration: inherit`.
  // That paints the link in the exact colour, weight and decoration as the
  // paragraph around it — indistinguishable from body text unless you happen
  // to hover it. Colour alone would not be enough anyway (WCAG 1.4.1), so the
  // underline is the part doing the real work.
  //
  // A link is a pass-through for the emphasis context, not a consumer of it:
  // `## Heading with [**a link**](url)` puts a `strong` two levels below the
  // heading, so a mapping that only reached direct children would leave exactly
  // that form painting an undeclared face. Measured — it was
  // `Space Grotesk|600|normal` before this.
  //
  // And since the underline is the part doing the real work, it is the part
  // that has to reach paper: `decoration-primary/40` composited to 1.95:1 on
  // white, leaving the link identifiable by colour alone — the exact 1.4.1
  // failure the underline was added to avoid. `print:decoration-primary` drops
  // the alpha the same way `print:border-primary` does above (PRA-1073).
  a: ({ href, children, inHeading, inEm }) =>
    h(
      "a",
      {
        href,
        className:
          "text-primary underline underline-offset-2 decoration-primary/40 print:decoration-primary hover:decoration-primary transition-colors",
      },
      withProps(children, () => ({ inHeading, inEm }))
    ),
};

// No `rehypePlugins` is the product configuration, and it is what makes a raw
// HTML tag in a body escape to visible angle brackets rather than render
// (PRA-1072). The parameter exists so the gate in `blog-posts.test.ts` can
// render the same body through the same component map with `rehype-raw` on:
// on the page the defect is invisible — the reader is shown `<del>40</del>`
// for a tag and `5 < 10` for a typed less-than, and both are literal text — so
// the only way to tell markup this renderer refused from punctuation the
// author meant is to compare against a renderer that keeps it. Every product
// caller passes nothing and gets the byte-identical output it did before.
export const renderMarkdownToHtml = (markdown, rehypePlugins = []) =>
  renderToStaticMarkup(h(Markdown, { components, rehypePlugins }, markdown));

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
