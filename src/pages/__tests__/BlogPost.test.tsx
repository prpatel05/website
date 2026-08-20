import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi } from "vitest";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";

/**
 * Lets a test hold the post body in flight, which is the only state in which
 * the loading placeholder exists. Hoisted because `vi.mock`'s factory runs
 * before anything at module scope here.
 */
const bodyChunk = vi.hoisted(() => {
  let release: (() => void) | null = null;
  return {
    held: false,
    wait: () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    arrive: () => {
      release?.();
      release = null;
    },
  };
});

vi.mock("framer-motion", () => {
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, prop) => {
        return ({ children, ...props }: Record<string, unknown>) => {
          const htmlProps: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(props)) {
            if (
              k === "className" ||
              k === "style" ||
              k === "href" ||
              k === "to" ||
              // The post body rides in on this one. Dropping it renders an
              // empty article and every body assertion below fails.
              k === "dangerouslySetInnerHTML"
            ) {
              htmlProps[k] = v;
            }
          }
          const Tag = typeof prop === "string" ? prop : "div";
          return <Tag {...htmlProps}>{children}</Tag>;
        };
      },
    }
  );
  return {
    m: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock("react-helmet-async", () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => <div data-testid="helmet">{children}</div>,
  HelmetProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import BlogPost from "../BlogPost";
import { BLOG_POST_CARD } from "@/lib/social-cards";

vi.mock("@/data/blog-posts/registry", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const testPost = {
    slug: "test-post",
    title: "Test Post Title",
    subtitle: "Test subtitle for the post",
    date: "Jan 1, 2026",
    dateISO: "2026-01-01",
    readTime: "5 min read",
    tags: ["testing", "vitest", "react"],
    image: "/images/test.png",
  };
  // The page is handed HTML, not markdown, so the fixture goes through the same
  // build-time renderer the real post bodies do. Handwriting the HTML here
  // would let the page and the build drift apart without a test noticing.
  const { renderMarkdownToHtml } = await import(
    "../../../scripts/markdown-html.mjs"
  );
  const testContent = renderMarkdownToHtml(
    `## Introduction\n\nThis is a **test paragraph** with *emphasis*.\n\n### Sub-heading\n\n- First item\n- Second item\n- Third item`
  );
  // Neighbours, so the prev/next links at the end of a post have somewhere to
  // point. Ordered newest first, the same as the real registry.
  const newerPost = { ...testPost, slug: "newer-post", title: "Newer Post Title" };
  const olderPost = { ...testPost, slug: "older-post", title: "Older Post Title" };
  const all = [newerPost, testPost, olderPost];
  const plainPost = { ...testPost, slug: "plain-post", title: "Plain Post Title" };
  const plainContent = renderMarkdownToHtml("Just a paragraph with **bold**.\n");
  const bySlug = [...all, plainPost];
  return {
    ...actual,
    getPostBySlug: (slug: string) => bySlug.find((p) => p.slug === slug),
    loadPostContent: async (slug: string) => {
      if (bodyChunk.held) await bodyChunk.wait();
      return slug === "plain-post" ? plainContent : testContent;
    },
    posts: all,
  };
});

function renderBlogPost(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/blog/${slug}`]}>
      <Routes>
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="*" element={<div>404 fallback</div>} />
      </Routes>
    </MemoryRouter>
  );
}

/**
 * The hero, located structurally. It used to be found by its alt text, which is
 * now empty — and a test that identifies an image by the string it is asserting
 * about cannot be the test that catches that string changing.
 */
const hero = (container: HTMLElement) => container.querySelector("article img");

describe("BlogPost", () => {
  it("renders post title and subtitle", () => {
    renderBlogPost("test-post");
    expect(screen.getByText("Test Post Title")).toBeInTheDocument();
    expect(screen.getByText("Test subtitle for the post")).toBeInTheDocument();
  });

  it("renders post metadata (date, read time, tags)", () => {
    renderBlogPost("test-post");
    expect(screen.getByText("Jan 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("5 min read")).toBeInTheDocument();
    expect(screen.getByText("#testing")).toBeInTheDocument();
    expect(screen.getByText("#vitest")).toBeInTheDocument();
    expect(screen.getByText("#react")).toBeInTheDocument();
  });

  it("renders markdown headings", async () => {
    renderBlogPost("test-post");
    await screen.findByRole("heading", { name: "Introduction" });
    expect(screen.getByRole("heading", { name: "Sub-heading" })).toBeInTheDocument();
  });

  it("renders markdown bold text", async () => {
    renderBlogPost("test-post");
    const bold = await screen.findByText("test paragraph");
    expect(bold.tagName).toBe("STRONG");
  });

  it("renders custom h2 with border-left styling", async () => {
    const { container } = renderBlogPost("test-post");
    await screen.findByRole("heading", { name: "Introduction" });
    const h2 = container.querySelector("h2.border-l-2");
    expect(h2).toBeTruthy();
    expect(h2!.textContent).toBe("Introduction");
  });

  it("renders markdown list items with custom bullets", async () => {
    renderBlogPost("test-post");
    await screen.findByText("First item");
    expect(screen.getByText("Second item")).toBeInTheDocument();
    // Check the ▸ bullet markers
    const bullets = screen.getAllByText("▸").filter((el) => el.className.includes("mt-1.5"));
    expect(bullets.length).toBe(3);
  });

  it("renders hero image with correct src", () => {
    const { container } = renderBlogPost("test-post");
    expect(hero(container)).toHaveAttribute("src", "/images/hero/test-704w.webp");
  });

  // The heroes are decorative abstract art. `alt` carried the post title, which
  // is verbatim the <h1> above the image, so a screen reader announced the
  // title twice: once as the heading and once as the description of a picture
  // that illustrates nothing the text does not already say.
  describe("the hero is described as decoration, not narrated twice", () => {
    it("gives the hero an empty alt", () => {
      const { container } = renderBlogPost("test-post");
      // Present and empty, not absent: a missing alt leaves the image in the
      // accessibility tree, where the fallback is announcing its filename.
      expect(hero(container)!.getAttribute("alt")).toBe("");
    });

    it("does not repeat the h1 as the image description", () => {
      const { container } = renderBlogPost("test-post");
      const h1 = container.querySelector("h1")!.textContent!.trim();

      expect(h1).toBe("Test Post Title");
      expect(hero(container)!.getAttribute("alt")!.trim()).not.toBe(h1);
    });

    // The card is shown with no page around it, so there the title is the only
    // description a scraper can offer.
    it("keeps the title on og:image:alt", () => {
      const { container } = renderBlogPost("test-post");
      expect(
        container
          .querySelector('meta[property="og:image:alt"]')
          ?.getAttribute("content")
      ).toBe("Test Post Title");
    });
  });

  // The hero is the LCP element on a post page. It was lazy for a while, which
  // hides it from the preload scanner and defers the fetch until after layout.
  describe("hero image is treated as the LCP element", () => {
    it("loads the hero eagerly", () => {
      const { container } = renderBlogPost("test-post");
      expect(hero(container)).toHaveAttribute("loading", "eager");
    });

    it("preloads the hero from the head at the same URL the img requests", () => {
      const { container } = renderBlogPost("test-post");
      const preload = container.querySelector('link[rel="preload"][as="image"]');
      expect(preload).toBeTruthy();
      expect(preload!.getAttribute("fetchpriority")).toBe("high");
      // A mismatch here — an absolute origin, say — costs a second download
      // instead of priming the one the <img> makes.
      expect(preload!.getAttribute("href")).toBe(
        hero(container)!.getAttribute("src")
      );
    });

    // The hero paints into a 704px column, so the <img> picks from a candidate
    // list rather than naming one file. A preload that carried only `href`
    // would run a different selection from the <img> and cost a second
    // download — react-helmet-async passes props through with setAttribute, so
    // this is also what proves the camelCase pair survives that pass.
    it("gives the preload the same candidate list as the img", () => {
      const { container } = renderBlogPost("test-post");
      const preload = container.querySelector('link[rel="preload"][as="image"]');
      const img = hero(container)!;

      expect(img).toHaveAttribute(
        "srcset",
        "/images/hero/test-704w.webp 704w, " +
          "/images/hero/test-960w.webp 960w, " +
          "/images/test.png 1200w"
      );
      expect(preload!.getAttribute("imagesrcset")).toBe(
        img.getAttribute("srcset")
      );
      expect(preload!.getAttribute("imagesizes")).toBe(
        img.getAttribute("sizes")
      );
      expect(preload!.getAttribute("imagesizes")).toBe(
        "(min-width: 768px) 704px, calc(100vw - 4rem)"
      );
    });
  });

  it("renders back navigation link", () => {
    renderBlogPost("test-post");
    expect(screen.getByText("cd ~")).toBeInTheDocument();
  });

  // A post used to end with one link, to the homepage preview of the five most
  // recent posts. Everything older than that was a dead end.
  describe("adjacent post navigation", () => {
    const navLinks = (container: HTMLElement) =>
      Array.from(
        container.querySelectorAll('nav[aria-label="More posts"] a')
      ).map((a) => [a.getAttribute("href"), a.textContent]);

    /**
     * The footer is held back until the body arrives — on every path now, not
     * only on a click-through (see the `pending` note in BlogPost). So these
     * wait for it. Waiting on the body rather than on the links themselves, so
     * a build that stopped rendering the footer fails on the assertion that
     * names it rather than timing out in a helper.
     */
    const renderLoadedPost = async (slug: string) => {
      const view = renderBlogPost(slug);
      await screen.findByRole("heading", { name: "Introduction" });
      return view;
    };

    it("links to the newer and older post from a middle post", async () => {
      const { container } = await renderLoadedPost("test-post");
      expect(navLinks(container)).toEqual([
        ["/blog/newer-post/", "newerNewer Post Title"],
        ["/blog/older-post/", "olderOlder Post Title"],
      ]);
    });

    it("offers only an older post on the newest post", async () => {
      const { container } = await renderLoadedPost("newer-post");
      expect(navLinks(container)).toEqual([
        ["/blog/test-post/", "olderTest Post Title"],
      ]);
    });

    it("offers only a newer post on the oldest post", async () => {
      const { container } = await renderLoadedPost("older-post");
      expect(navLinks(container)).toEqual([
        ["/blog/test-post/", "newerTest Post Title"],
      ]);
    });

    it("sends the archive link to the full list, not the homepage preview", async () => {
      await renderLoadedPost("test-post");
      expect(screen.getByText("ls ../posts").closest("a")).toHaveAttribute(
        "href",
        "/blog/"
      );
    });
  });

  // Posts used to dead-end at newer/older + ls ../posts. The share/subscribe
  // row is the distribution exit: copy the canonical URL, hand it to X or
  // LinkedIn, or subscribe via RSS / Substack. URL construction is owned by
  // share-urls.test.ts and PostShare.test.tsx; this is the "the page actually
  // mounts the row with the footer" half.
  describe("share and subscribe row", () => {
    it("renders the row once the body is in", async () => {
      renderBlogPost("test-post");
      await screen.findByRole("heading", { name: "Introduction" });

      expect(screen.getByText("// share")).toBeInTheDocument();
      expect(screen.getByText("// subscribe")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "copy url" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "share on x" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "linkedin" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "rss" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "substack" })).toBeInTheDocument();
    });
  });

  // The href half of the same rule the structured-data tests below enforce.
  // A post page is the densest internal linking on the site — two adjacent-post
  // links plus the archive link — so a slashless href here sends a crawler
  // through a 301 on nearly every edge of the site graph.
  it("points every internal link at its non-redirecting trailing-slash form", async () => {
    const { container } = renderBlogPost("test-post");
    // The closing links are part of the footer, which does not exist until the
    // body does. Without this the list below is just the nav's `cd ~`.
    await screen.findByRole("heading", { name: "Introduction" });
    const hrefs = Array.from(container.querySelectorAll("a[href^='/']")).map(
      (a) => a.getAttribute("href")
    );

    expect(hrefs).toEqual([
      // The bare origin is the one path served without a redirect.
      "/",
      "/blog/newer-post/",
      "/blog/older-post/",
      "/blog/",
    ]);
  });

  // Every internal href on the site now carries a trailing slash, so a client
  // -side click hands the router "/blog/test-post/" rather than the slashless
  // form. React Router ignores the trailing slash when matching and keeps it
  // out of the param — if that ever stops being true, every in-app navigation
  // on the site falls through to the 404 route.
  it("matches the trailing-slash form of its own route", () => {
    render(
      <MemoryRouter initialEntries={["/blog/test-post/"]}>
        <Routes>
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="*" element={<div>404 fallback</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Test Post Title")).toBeInTheDocument();
    expect(screen.queryByText("404 fallback")).not.toBeInTheDocument();
  });

  /**
   * A client-side navigation has no body until its chunk lands. The page used
   * to render the meta, title, subtitle, hero and the entire end-of-post footer
   * against an empty article for the whole round trip — a post that looks
   * published with no words in it, with the newer/older cards directly under
   * the hero — and then grew ~4.8x in height when the body arrived.
   *
   * Most of these navigate by a real click on a `<Link>`, which is the forward
   * case. It used to be the *only* case that could reach this state, because
   * `pending` also required `!firstLoad` — and the initial memory entry carries
   * react-router's `"default"` key, the same one a loaded document reports.
   *
   * That gate was wrong, and the last test here is why (PRA-930): a first-load
   * key does not imply a body in the markup. react-router restores the loaded
   * key on a POP back to the entry the document came up on, and by then
   * `AnimatePresence` has unmounted the prerendered article. `pending` is now
   * `!content`, which is the condition that was actually meant, so an initial
   * entry with nothing to read shows the placeholder like any other.
   *
   * The e2e half (`e2e/post-body-pending.spec.ts`) drives the real Back over a
   * real held chunk; this half is the state machine.
   */
  describe("while the body chunk is in flight", () => {
    // Unconditional, and not a `finally` inside each test: a test that fails
    // before releasing the chunk would otherwise leave it held for every test
    // after it, and one real failure would report as several.
    afterEach(async () => {
      bodyChunk.held = false;
      bodyChunk.arrive();
      // Settle the released promise inside an act scope, so the state update it
      // causes is not logged against whatever test runs next.
      await act(async () => {});
    });

    const clickThroughToPost = async () => {
      const view = render(
        <MemoryRouter initialEntries={["/blog/"]}>
          <Routes>
            <Route path="/blog/" element={<Link to="/blog/test-post/">open</Link>} />
            <Route path="/blog/:slug" element={<BlogPost />} />
          </Routes>
        </MemoryRouter>
      );
      await userEvent.click(screen.getByText("open"));
      return view;
    };

    it("says the text is loading instead of showing an empty post", async () => {
      bodyChunk.held = true;
      const { container } = await clickThroughToPost();

      // The precondition: this is the empty-article window, not a page that
      // quietly finished loading before the assertions ran. Asserted on the
      // body text rather than on `[data-post-body]`, which the framer mock
      // above strips along with every other prop it does not forward.
      expect(screen.queryByText("Introduction")).toBeNull();
      expect(screen.getByText("// loading")).toBeInTheDocument();

      // ...and the end of the article is not drawn under a post that has not
      // started. Neighbour cards, closing links, and the share row.
      expect(container.querySelector('nav[aria-label="More posts"]')).toBeNull();
      expect(screen.queryByText("ls ../posts")).toBeNull();
      expect(screen.queryByText("// share")).toBeNull();
    });

    it("hands the page over to the real body once the chunk lands", async () => {
      bodyChunk.held = true;
      const { container } = await clickThroughToPost();
      expect(screen.getByText("// loading")).toBeInTheDocument();

      bodyChunk.held = false;
      bodyChunk.arrive();

      await screen.findByRole("heading", { name: "Introduction" });
      // The placeholder goes, and everything it was holding back comes back —
      // a skeleton that outlives its body would be the same defect wearing a
      // different mask.
      await waitFor(() => {
        expect(screen.queryByText("// loading")).toBeNull();
      });
      expect(
        container.querySelector('nav[aria-label="More posts"]')
      ).toBeTruthy();
      expect(screen.getByText("ls ../posts")).toBeInTheDocument();
      expect(screen.getByText("// share")).toBeInTheDocument();
    });

    // The control: with the chunk arriving normally, the same journey never
    // shows the placeholder. Without this, a build that rendered "// loading"
    // permanently would pass the test above.
    it("shows no placeholder when the chunk is not held", async () => {
      await clickThroughToPost();
      expect(await screen.findByRole("heading", { name: "Introduction" })).toBeInTheDocument();
      expect(screen.queryByText("// loading")).toBeNull();
    });

    /**
     * The `firstLoad` half. This mounts on the initial memory entry — key
     * `"default"`, the same one `useFirstLoad` sees on a document load and on a
     * Back onto the entry the document loaded on — with no prerendered markup
     * to read, which is exactly the state that Back leaves behind. Under the
     * old `!firstLoad` gate the placeholder was suppressed here and the footer
     * rendered under an empty article; a jsdom render has no server HTML, so
     * this case has always been reachable in this file and was never asserted.
     */
    it("says it is loading on a first-load key with no markup to read", async () => {
      bodyChunk.held = true;
      const { container } = renderBlogPost("test-post");

      expect(screen.queryByText("Introduction")).toBeNull();
      expect(screen.getByText("// loading")).toBeInTheDocument();
      expect(container.querySelector('nav[aria-label="More posts"]')).toBeNull();
      expect(screen.queryByText("ls ../posts")).toBeNull();
      expect(screen.queryByText("// share")).toBeNull();

      // ...and it still resolves into the post, so this is a wait and not a
      // build that suppressed the article on every first load.
      bodyChunk.held = false;
      bodyChunk.arrive();
      await screen.findByRole("heading", { name: "Introduction" });
      await waitFor(() => {
        expect(container.querySelector('nav[aria-label="More posts"]')).toBeTruthy();
      });
    });
  });


  describe("reading chrome", () => {
    it("exposes a reading progressbar once the body is in", async () => {
      renderBlogPost("test-post");
      await screen.findByRole("heading", { name: "Introduction" });
      const bar = screen.getByRole("progressbar", { name: "Reading progress" });
      expect(bar).toHaveAttribute("aria-valuemin", "0");
      expect(bar).toHaveAttribute("aria-valuemax", "100");
    });

    it("builds a contents list from H2s, not H3s", async () => {
      renderBlogPost("test-post");
      await screen.findByRole("heading", { name: "Introduction" });
      const toc = screen.getByRole("navigation", { name: "Contents" });
      expect(toc).toHaveTextContent("// contents");
      expect(toc).toHaveTextContent("Introduction");
      expect(toc).not.toHaveTextContent("Sub-heading");
      const tocLink = toc.querySelector("a[href=\"#introduction\"]");
      expect(tocLink).toBeTruthy();
      expect(tocLink).toHaveTextContent("Introduction");
    });

    it("hides the contents list when the post has no H2s", async () => {
      renderBlogPost("plain-post");
      await screen.findByText(/Just a paragraph with/);
      expect(screen.queryByRole("navigation", { name: "Contents" })).toBeNull();
    });

    it("puts a hash id on the rendered H2", async () => {
      const { container } = renderBlogPost("test-post");
      await screen.findByRole("heading", { name: "Introduction" });
      const h2 = container.querySelector("h2#introduction");
      expect(h2).toBeTruthy();
      expect(h2!.textContent).toBe("Introduction");
    });
  });
  it("renders NotFound for unknown slug", () => {
    renderBlogPost("nonexistent-slug");
    // The BlogPost component returns <NotFound /> which shows the 404 page
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText(/Page not found/)).toBeInTheDocument();
  });

  // Absolute, and pointing at the derived JPEG card rather than the post's
  // own hero: LinkedIn's image spec does not list WebP, which is what every
  // hero master is. What the page paints is asserted separately below.
  it("names the derived JPEG card on og:image, absolutely", () => {
    const { container } = renderBlogPost("test-post");
    expect(
      container
        .querySelector('meta[property="og:image"]')
        ?.getAttribute("content"),
    ).toBe("https://pratik.pa.tel/images/social/test.jpg");
  });

  // A card only X renders is no better than one only LinkedIn renders.
  it("points twitter:image at the same card", () => {
    const { container } = renderBlogPost("test-post");
    expect(
      container
        .querySelector('meta[name="twitter:image"]')
        ?.getAttribute("content"),
    ).toBe("https://pratik.pa.tel/images/social/test.jpg");
  });

  // Moving og:image off the hero must not move what the browser downloads:
  // the hero is the LCP element, and its WebP srcSet is why it is small.
  it("leaves the painted hero on its WebP variant", () => {
    const { container } = renderBlogPost("test-post");
    const src = container.querySelector("img")?.getAttribute("src");

    expect(src).toContain(".webp");
    expect(src).not.toContain("/social/");
  });

  // Declared so the first scrape picks the large-card layout without having to
  // fetch the image to measure it. social-cards.test.ts holds the other half:
  // that every post image really is this size.
  it("declares the blog card dimensions on og:image", () => {
    const { container } = renderBlogPost("test-post");
    const meta = (property: string) =>
      container
        .querySelector(`meta[property="${property}"]`)
        ?.getAttribute("content");

    expect(meta("og:image:width")).toBe(String(BLOG_POST_CARD.width));
    expect(meta("og:image:height")).toBe(String(BLOG_POST_CARD.height));
  });

  // og:type="article" is a promise that the article:* block follows it.
  // Scrapers that honour it — LinkedIn, where these posts are distributed —
  // render the card with no date when it does not, so every post in the feed
  // looks equally old.
  describe("article metadata", () => {
    const meta = (property: string) => {
      const { container } = renderBlogPost("test-post");
      return container
        .querySelector(`meta[property="${property}"]`)
        ?.getAttribute("content");
    };

    it("dates the article at the same instant the RSS item uses", () => {
      // generate-feed.mjs widens dateISO with T12:00:00Z. Diverging here would
      // put the card and the feed on different days for readers either side of
      // UTC.
      expect(meta("article:published_time")).toBe("2026-01-01T12:00:00.000Z");
    });

    it("names the author and the site on the card", () => {
      expect(meta("article:author")).toBe("Pratik Patel");
      expect(meta("og:site_name")).toBe("Pratik Patel");
    });
  });

  // The JSON-LD here is hand-built, so it does not pick up the normalization
  // SEO.tsx applies to canonical/og:url. Every page URL it declares has to
  // carry the trailing slash on its own, or the structured data points at
  // addresses that 301.
  describe("structured data URLs", () => {
    const jsonLd = () => {
      const { container } = renderBlogPost("test-post");
      const scripts = container.querySelectorAll(
        'script[type="application/ld+json"]'
      );
      return Array.from(scripts).flatMap((s) => JSON.parse(s.textContent ?? ""));
    };

    it("declares the post URL in its non-redirecting form", () => {
      const posting = jsonLd().find((n) => n["@type"] === "BlogPosting");
      expect(posting.url).toBe("https://pratik.pa.tel/blog/test-post/");
    });

    it("points every breadcrumb at a URL that serves 200", () => {
      const crumbs = jsonLd().find((n) => n["@type"] === "BreadcrumbList");
      expect(crumbs.itemListElement.map((i) => i.item)).toEqual([
        // The bare origin is the one path GitHub Pages serves without a
        // redirect, so it stays slashless.
        "https://pratik.pa.tel",
        "https://pratik.pa.tel/blog/",
        "https://pratik.pa.tel/blog/test-post/",
      ]);
    });
  });
});
