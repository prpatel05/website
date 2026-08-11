import { describe, expect, it } from "vitest";
import { posts } from "@/data/blog-posts/registry";
import {
  BLOG_TITLE,
  HOME_TITLE,
  NOT_FOUND_TITLE,
  postTitle,
  routeTitle,
} from "../route-title";

/**
 * `routeTitle` is what the live region announces after a client-side
 * navigation, so a wrong answer here is a screen-reader user being told they
 * are on a page they are not.
 */
describe("routeTitle", () => {
  it("names the two static routes", () => {
    expect(routeTitle("/")).toBe(HOME_TITLE);
    expect(routeTitle("/blog")).toBe(BLOG_TITLE);
  });

  it("names a post from the registry", () => {
    const post = posts[0];
    expect(routeTitle(`/blog/${post.slug}`)).toBe(postTitle(post.title));
  });

  /**
   * Every URL on this site carries a trailing slash — the canonical, the
   * sitemap and every internal `<Link>` all do, so the trailing-slash form is
   * the one a real navigation actually produces. A matcher that only handled
   * the bare form would announce "404" for every page on the site.
   */
  it("resolves the trailing-slash form every link on the site uses", () => {
    expect(routeTitle("/blog/")).toBe(BLOG_TITLE);
    expect(routeTitle(`/blog/${posts[0].slug}/`)).toBe(postTitle(posts[0].title));
  });

  it("falls back to the 404 title for URLs that render NotFound", () => {
    // BlogPost itself renders <NotFound /> when the registry has no such post,
    // so the announcement has to agree with what is on screen.
    expect(routeTitle("/blog/no-such-post")).toBe(NOT_FOUND_TITLE);
    expect(routeTitle("/nope")).toBe(NOT_FOUND_TITLE);
    expect(routeTitle("/blog/agents-fail-quietly/extra")).toBe(NOT_FOUND_TITLE);
  });

  /**
   * The whole point of the module: the announcement and the `<title>` come from
   * the same constants, so they cannot drift. If a page ever goes back to a
   * literal, this is the test that should start failing — every published post
   * resolves to a distinct, non-404 title.
   */
  it("gives every published post its own title", () => {
    const titles = posts.map((p) => routeTitle(`/blog/${p.slug}/`));
    expect(titles).not.toContain(NOT_FOUND_TITLE);
    expect(new Set(titles).size).toBe(posts.length);
  });
});
