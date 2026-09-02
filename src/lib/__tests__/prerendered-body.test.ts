import { describe, it, expect, afterEach } from "vitest";
import { POST_BODY_ATTR, prerenderedBody } from "../prerendered-body";

const plant = (slug: string, html: string) => {
  document.body.innerHTML = `<div ${POST_BODY_ATTR}="${slug}">${html}</div>`;
};

describe("prerenderedBody", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns the body the prerender left in the page", () => {
    plant("a-post", "<p>Body</p>");
    expect(prerenderedBody("a-post")).toBe("<p>Body</p>");
  });

  it("returns exactly what the DOM would serialize", () => {
    // The point of reading `innerHTML` rather than re-deriving the string is
    // that React compares its `dangerouslySetInnerHTML` against this very
    // value during hydration. Anything short of byte equality is a mismatch,
    // so the assertion is against the DOM's own output, not the input.
    plant("a-post", "<p class='x'>Body &amp; more</p>");
    const el = document.querySelector(`[${POST_BODY_ATTR}]`)!;
    expect(prerenderedBody("a-post")).toBe(el.innerHTML);
  });

  it("ignores markup belonging to a different post", () => {
    // What stops a client-side navigation from adopting the outgoing post's
    // body: the seed is keyed on the slug being rendered, not on presence.
    plant("a-post", "<p>Body</p>");
    expect(prerenderedBody("another-post")).toBe("");
  });

  it("returns nothing when the page was not prerendered", () => {
    document.body.innerHTML = "<div></div>";
    expect(prerenderedBody("a-post")).toBe("");
  });

  it("returns nothing without a slug", () => {
    plant("a-post", "<p>Body</p>");
    expect(prerenderedBody(undefined)).toBe("");
  });

  it("does not throw on a slug that is not a valid selector", () => {
    // `slug` comes off the URL. Interpolating it into a selector would make
    // this a thrown SyntaxError during render rather than an empty string.
    plant("a-post", "<p>Body</p>");
    expect(() => prerenderedBody('a"]:has(')).not.toThrow();
    expect(prerenderedBody('a"]:has(')).toBe("");
  });
});
