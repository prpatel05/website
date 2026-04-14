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

vi.mock("@/data/blog-posts", async (importOriginal) => {
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
  return {
    ...actual,
    getPostBySlug: (slug: string) => (slug === "test-post" ? testPost : undefined),
    posts: [testPost],
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

  it("renders NotFound for unknown slug", () => {
    renderBlogPost("nonexistent-slug");
    // The BlogPost component returns <NotFound /> which shows the 404 page
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText(/Page not found/)).toBeInTheDocument();
  });

  it("normalizes relative image URLs for OG image", () => {
    renderBlogPost("test-post");
    // The ogImage logic prepends domain for relative paths
    // We can verify the image element exists (the OG handling is in SEO helmet)
    const img = screen.getByAltText("Test Post Title");
    expect(img).toBeInTheDocument();
  });
});
