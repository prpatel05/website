import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

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

import Blog from "../Blog";
import { SITE_CARD } from "@/lib/social-cards";
import { THUMBNAIL_SIZES } from "@/lib/blog-thumbnails";

const { testPosts } = vi.hoisted(() => ({
  testPosts: [
    {
      slug: "second-post",
      title: "Second Post",
      subtitle: "Subtitle two",
      date: "Feb 2, 2026",
      dateISO: "2026-02-02",
      readTime: "4 min read",
      tags: ["agents"],
      image: "/images/second.png",
      content: "body",
    },
    {
      slug: "first-post",
      title: "First Post",
      subtitle: "Subtitle one",
      date: "Jan 1, 2026",
      dateISO: "2026-01-01",
      readTime: "5 min read",
      tags: ["testing", "vitest"],
      image: "https://cdn.example.com/first.png",
      content: "body",
    },
  ],
}));

vi.mock("@/data/blog-posts/registry", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, posts: testPosts };
});

function renderBlog() {
  return render(
    <MemoryRouter initialEntries={["/blog"]}>
      <Blog />
    </MemoryRouter>
  );
}

function blogJsonLd(container: HTMLElement) {
  const scripts = Array.from(container.querySelectorAll("script"));
  const parsed = scripts.flatMap((s) => {
    try {
      const value = JSON.parse(s.textContent ?? "");
      return Array.isArray(value) ? value : [value];
    } catch {
      return [];
    }
  });
  return parsed;
}

describe("Blog archive", () => {
  it("renders every post in the registry", () => {
    renderBlog();
    expect(screen.getByText("Second Post")).toBeInTheDocument();
    expect(screen.getByText("First Post")).toBeInTheDocument();
  });

  // The href counterpart of the structured-data rule below: the archive is the
  // page a crawler is most likely to enter the blog through, so a slashless
  // post href costs a 301 on the way to every post.
  it("points every internal link at its non-redirecting trailing-slash form", () => {
    const { container } = renderBlog();
    const hrefs = Array.from(container.querySelectorAll("a[href^='/']")).map(
      (a) => a.getAttribute("href")
    );

    expect(hrefs).toEqual([
      // The bare origin is the one path served without a redirect.
      "/",
      ...testPosts.map((post) => `/blog/${post.slug}/`),
    ]);
  });

  // Guard for the defect: the archive was the only page on the site emitting no
  // structured data, so crawlers had to find posts one BlogPosting at a time.
  it("emits Blog structured data listing every post", () => {
    const { container } = renderBlog();
    const blog = blogJsonLd(container).find((n) => n["@type"] === "Blog");

    expect(blog).toBeDefined();
    expect(blog.url).toBe("https://pratik.pa.tel/blog/");
    expect(blog.blogPost).toHaveLength(testPosts.length);
    expect(blog.blogPost.map((p: { url: string }) => p.url)).toEqual([
      "https://pratik.pa.tel/blog/second-post/",
      "https://pratik.pa.tel/blog/first-post/",
    ]);
  });

  // Every bare-form URL 301s on GitHub Pages, so a redirecting URL in
  // structured data would reintroduce the defect #45 fixes for canonical/og:url.
  it("points structured data at non-redirecting trailing-slash URLs", () => {
    const { container } = renderBlog();
    const nodes = blogJsonLd(container);
    const blog = nodes.find((n) => n["@type"] === "Blog");
    const crumbs = nodes.find((n) => n["@type"] === "BreadcrumbList");

    const blogUrls = [blog.url, ...blog.blogPost.map((p: { url: string }) => p.url)];
    for (const url of blogUrls) {
      expect(url.endsWith("/")).toBe(true);
    }

    // The bare origin is served directly and must not gain a slash.
    expect(crumbs.itemListElement[0].item).toBe("https://pratik.pa.tel");
    expect(crumbs.itemListElement[1].item).toBe("https://pratik.pa.tel/blog/");
  });

  it("absolutizes relative post images and leaves absolute ones alone", () => {
    const { container } = renderBlog();
    const blog = blogJsonLd(container).find((n) => n["@type"] === "Blog");

    expect(blog.blogPost.map((p: { image: string }) => p.image)).toEqual([
      "https://pratik.pa.tel/images/second.png",
      "https://cdn.example.com/first.png",
    ]);
  });

  // The archive used to borrow posts[0].image, so every publish silently
  // changed what an already-shared /blog/ link previewed as — and the alt text
  // described one article on a page listing the whole archive. The newest
  // fixture post is /images/second.png, so borrowing would be visible here.
  it("shares the stable site card, not whichever post is newest", () => {
    const { container } = renderBlog();
    const meta = (property: string) =>
      container
        .querySelector(`meta[property="${property}"]`)
        ?.getAttribute("content");

    expect(meta("og:image")).toBe(SITE_CARD.url);
    expect(meta("og:image:alt")).toBe(
      "Pratik Patel — CTO & Chief Architect — pratik.pa.tel",
    );
    expect(meta("og:image:width")).toBe(String(SITE_CARD.width));
    expect(meta("og:image:height")).toBe(String(SITE_CARD.height));
  });

  it("emits a Home > Blog breadcrumb trail", () => {
    const { container } = renderBlog();
    const crumbs = blogJsonLd(container).find((n) => n["@type"] === "BreadcrumbList");

    expect(crumbs.itemListElement.map((c: { name: string }) => c.name)).toEqual(["Home", "Blog"]);
  });

  // The card paints a 128x96 box. Pointing it at the 1200x670 hero shipped
  // roughly 200x the pixels it displays — about 1.0MB across the archive — so
  // it has to ask for the thumbnail the build emits instead.
  it("paints the card from the generated thumbnail, not the full hero", () => {
    const { container } = renderBlog();
    const thumb = container.querySelector<HTMLImageElement>(
      'img[alt="Second Post"]'
    );

    expect(thumb.getAttribute("src")).toBe("/images/thumbs/second-320w.webp");
    expect(thumb.getAttribute("srcset")).toBe(
      "/images/thumbs/second-320w.webp 320w, /images/thumbs/second-640w.webp 640w"
    );
    expect(thumb.getAttribute("sizes")).toBe(THUMBNAIL_SIZES);
  });

  // A hero the build does not own has no thumbnail to point at, so the card
  // keeps the original rather than requesting a file that will never exist.
  it("falls back to the hero when there is no thumbnail for it", () => {
    const { container } = renderBlog();
    const remote = container.querySelector<HTMLImageElement>(
      'img[alt="First Post"]'
    );

    expect(remote.getAttribute("src")).toBe("https://cdn.example.com/first.png");
    expect(remote.getAttribute("srcset")).toBeNull();
    expect(remote.getAttribute("sizes")).toBeNull();
  });
});
