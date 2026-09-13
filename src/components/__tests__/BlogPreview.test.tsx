import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SELECTED_WRITING_SLUGS } from "@/data/selected-writing";
import { getPostBySlug, posts } from "@/data/blog-posts/registry";
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

const latestPost = posts[0];
if (!latestPost) throw new Error("registry has no posts");

const selectedPosts = SELECTED_WRITING_SLUGS.map((slug) => {
  const post = getPostBySlug(slug);
  if (!post) throw new Error(`selected slug missing from registry: ${slug}`);
  return post;
});

const selectedWithoutLatest = selectedPosts.filter((post) => post.slug !== latestPost.slug);

describe("BlogPreview", () => {
  it("features posts[0] as the Latest card with a trailing-slash permalink", () => {
    const { container } = render(
      <MemoryRouter>
        <BlogPreview />
      </MemoryRouter>
    );

    expect(screen.getByText("// latest")).toBeInTheDocument();
    expect(screen.getByText(latestPost.title)).toBeInTheDocument();

    const latestLink = container.querySelector("a[data-latest-post]");
    expect(latestLink).not.toBeNull();
    expect(latestLink).toHaveAttribute("href", `/blog/${latestPost.slug}/`);
  });

  it("renders the curated Selected writing posts under Latest, not newest-N", () => {
    const { container } = render(
      <MemoryRouter>
        <BlogPreview />
      </MemoryRouter>
    );

    expect(screen.getByText("Selected")).toBeInTheDocument();
    expect(screen.getByText("writing")).toBeInTheDocument();
    expect(screen.queryByText("Recent")).not.toBeInTheDocument();

    // Latest + Selected (minus overlap) — never the raw newest-five list.
    const postLinks = container.querySelectorAll("article a");
    expect(postLinks).toHaveLength(1 + selectedWithoutLatest.length);

    for (const post of selectedWithoutLatest) {
      expect(screen.getByText(post.title)).toBeInTheDocument();
    }

    // If latest is also curated, it appears once (Latest only), not twice.
    const titleMatches = screen.getAllByText(latestPost.title);
    expect(titleMatches).toHaveLength(1);
  });

  // Every pratik.pa.tel path 301s to its trailing-slash form, so a slashless
  // href is a link the crawler has to follow twice. The homepage carries the
  // Latest permalink, the archive link, the series hub, and the curated posts.
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
      `/blog/${latestPost.slug}/`,
      "/blog/",
      SERIES_HREF,
      ...selectedWithoutLatest.map((post) => `/blog/${post.slug}/`),
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
