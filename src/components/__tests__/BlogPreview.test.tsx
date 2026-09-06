import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SELECTED_WRITING_SLUGS } from "@/data/selected-writing";
import { getPostBySlug } from "@/data/blog-posts/registry";
import { SERIES_HREF } from "@/lib/blog-series";

vi.mock("framer-motion", () => {
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, prop) => {
        return ({ children, ...props }: Record<string, unknown>) => {
          const htmlProps: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(props)) {
            if (key === "className" || key === "style" || key === "ref" || key === "id") {
              htmlProps[key] = value;
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
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useTransform: (_value: unknown, _input: unknown, output: unknown[]) => output?.[0] ?? 0,
    useReducedMotion: () => false,
  };
});

vi.mock("lucide-react", () => ({
  ArrowUpRight: () => <span data-testid="arrow-up-right" />,
}));

import BlogPreview from "../BlogPreview";

const selectedPosts = SELECTED_WRITING_SLUGS.map((slug) => {
  const post = getPostBySlug(slug);
  if (!post) throw new Error(`selected slug missing from registry: ${slug}`);
  return post;
});

describe("BlogPreview", () => {
  it("renders the curated Selected writing posts, not newest-five", () => {
    const { container } = render(
      <MemoryRouter>
        <BlogPreview />
      </MemoryRouter>
    );

    expect(screen.getByText("Selected")).toBeInTheDocument();
    expect(screen.getByText("writing")).toBeInTheDocument();
    expect(screen.queryByText("Recent")).not.toBeInTheDocument();

    const postLinks = container.querySelectorAll("article a");
    expect(postLinks).toHaveLength(SELECTED_WRITING_SLUGS.length);

    for (const post of selectedPosts) {
      expect(screen.getByText(post.title)).toBeInTheDocument();
    }
  });

  // Every pratik.pa.tel path 301s to its trailing-slash form, so a slashless
  // href is a link the crawler has to follow twice. The homepage carries the
  // archive link, the series hub, and the curated posts.
  it("points every internal link at its non-redirecting trailing-slash form", () => {
    const { container } = render(
      <MemoryRouter>
        <BlogPreview />
      </MemoryRouter>
    );

    const hrefs = Array.from(container.querySelectorAll("a[href^='/']")).map(
      (a) => a.getAttribute("href")
    );

    expect(hrefs).toEqual([
      "/blog/",
      SERIES_HREF,
      ...selectedPosts.map((post) => `/blog/${post.slug}/`),
    ]);
  });

  it("keeps the ls ./posts archive affordance for keyboard/e2e contracts", () => {
    render(
      <MemoryRouter>
        <BlogPreview />
      </MemoryRouter>
    );
    expect(screen.getByText(/ls \.\/posts/)).toBeInTheDocument();
  });
});
