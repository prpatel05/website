import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { posts } from "@/data/blog-posts/registry";

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
  };
});

vi.mock("lucide-react", () => ({
  ArrowUpRight: () => <span data-testid="arrow-up-right" />,
}));

import BlogPreview from "../BlogPreview";

describe("BlogPreview", () => {
  it("renders only the latest five posts on the homepage", () => {
    const { container } = render(
      <MemoryRouter>
        <BlogPreview />
      </MemoryRouter>
    );

    const postLinks = container.querySelectorAll("article a");
    expect(postLinks).toHaveLength(5);

    for (const post of posts.slice(0, 5)) {
      expect(screen.getByText(post.title)).toBeInTheDocument();
    }

    expect(screen.queryByText(posts[5].title)).not.toBeInTheDocument();
  });

  // Every pratik.pa.tel path 301s to its trailing-slash form, so a slashless
  // href is a link the crawler has to follow twice. The homepage carries the
  // archive link plus the five newest posts, so it is where that cost lands
  // first.
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
      ...posts.slice(0, 5).map((post) => `/blog/${post.slug}/`),
    ]);
  });
});
