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

  it("emits a Home > Blog breadcrumb trail", () => {
    const { container } = renderBlog();
    const crumbs = blogJsonLd(container).find((n) => n["@type"] === "BreadcrumbList");

    expect(crumbs.itemListElement.map((c: { name: string }) => c.name)).toEqual(["Home", "Blog"]);
  });
});
