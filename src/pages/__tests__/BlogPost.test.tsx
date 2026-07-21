import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("framer-motion", () => {
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, prop) => {
        return ({ children, ...props }: Record<string, unknown>) => {
          const htmlProps: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(props)) {
            if (k === "className" || k === "style" || k === "href" || k === "to") {
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
    motion: motionProxy,
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
    content: `## Introduction\n\nThis is a **test paragraph** with *emphasis*.\n\n### Sub-heading\n\n- First item\n- Second item\n- Third item`,
  };
  // Neighbours, so the prev/next links at the end of a post have somewhere to
  // point. Ordered newest first, the same as the real registry.
  const newerPost = { ...testPost, slug: "newer-post", title: "Newer Post Title" };
  const olderPost = { ...testPost, slug: "older-post", title: "Older Post Title" };
  const all = [newerPost, testPost, olderPost];
  return {
    ...actual,
    getPostBySlug: (slug: string) => all.find((p) => p.slug === slug),
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

  it("renders markdown headings", () => {
    renderBlogPost("test-post");
    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Sub-heading")).toBeInTheDocument();
  });

  it("renders markdown bold text", () => {
    renderBlogPost("test-post");
    const bold = screen.getByText("test paragraph");
    expect(bold.tagName).toBe("STRONG");
  });

  it("renders custom h2 with border-left styling", () => {
    const { container } = renderBlogPost("test-post");
    const h2 = container.querySelector("h2.border-l-2");
    expect(h2).toBeTruthy();
    expect(h2!.textContent).toBe("Introduction");
  });

  it("renders markdown list items with custom bullets", () => {
    renderBlogPost("test-post");
    expect(screen.getByText("First item")).toBeInTheDocument();
    expect(screen.getByText("Second item")).toBeInTheDocument();
    // Check the ▸ bullet markers
    const bullets = screen.getAllByText("▸");
    expect(bullets.length).toBe(3);
  });

  it("renders hero image with correct src and alt", () => {
    renderBlogPost("test-post");
    const img = screen.getByAltText("Test Post Title");
    expect(img).toHaveAttribute("src", "/images/test.png");
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

    it("links to the newer and older post from a middle post", () => {
      const { container } = renderBlogPost("test-post");
      expect(navLinks(container)).toEqual([
        ["/blog/newer-post/", "newerNewer Post Title"],
        ["/blog/older-post/", "olderOlder Post Title"],
      ]);
    });

    it("offers only an older post on the newest post", () => {
      const { container } = renderBlogPost("newer-post");
      expect(navLinks(container)).toEqual([
        ["/blog/test-post/", "olderTest Post Title"],
      ]);
    });

    it("offers only a newer post on the oldest post", () => {
      const { container } = renderBlogPost("older-post");
      expect(navLinks(container)).toEqual([
        ["/blog/test-post/", "newerTest Post Title"],
      ]);
    });

    it("sends the archive link to the full list, not the homepage preview", () => {
      renderBlogPost("test-post");
      expect(screen.getByText("ls ../posts").closest("a")).toHaveAttribute(
        "href",
        "/blog/"
      );
    });
  });

  // The href half of the same rule the structured-data tests below enforce.
  // A post page is the densest internal linking on the site — two adjacent-post
  // links plus the archive link — so a slashless href here sends a crawler
  // through a 301 on nearly every edge of the site graph.
  it("points every internal link at its non-redirecting trailing-slash form", () => {
    const { container } = renderBlogPost("test-post");
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

  it("renders NotFound for unknown slug", () => {
    renderBlogPost("nonexistent-slug");
    // The BlogPost component returns <NotFound /> which shows the 404 page
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText(/Page not found/)).toBeInTheDocument();
  });

  it("normalizes relative image URLs for OG image", () => {
    const { container } = renderBlogPost("test-post");
    expect(
      container
        .querySelector('meta[property="og:image"]')
        ?.getAttribute("content"),
    ).toBe("https://pratik.pa.tel/images/test.png");
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
