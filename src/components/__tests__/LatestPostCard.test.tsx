import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { posts } from "@/data/blog-posts/registry";
import { postDescription } from "@/lib/post-description";
import LatestPostCard from "../LatestPostCard";

const latestPost = posts[0];
if (!latestPost) throw new Error("registry has no posts");

describe("LatestPostCard", () => {
  it("features posts[0] as a fully clickable trailing-slash permalink", () => {
    const { container } = render(
      <MemoryRouter>
        <LatestPostCard />
      </MemoryRouter>
    );

    expect(screen.getByText("// latest")).toBeInTheDocument();
    expect(screen.getByText(latestPost.title)).toBeInTheDocument();
    expect(screen.getByText(latestPost.date)).toBeInTheDocument();
    expect(screen.getByText(latestPost.readTime)).toBeInTheDocument();
    expect(screen.getByText(postDescription(latestPost))).toBeInTheDocument();
    expect(screen.getByText("read post")).toBeInTheDocument();

    const latestLink = container.querySelector("a[data-latest-post]");
    expect(latestLink).not.toBeNull();
    expect(latestLink).toHaveAttribute("href", `/blog/${latestPost.slug}/`);
    expect(latestLink).toHaveAttribute(
      "aria-label",
      `Read the latest post: ${latestPost.title}`
    );
  });

  it("renders the title as an h2 so the hero's h1 is followed in order", () => {
    render(
      <MemoryRouter>
        <LatestPostCard />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 2, name: latestPost.title })).toBeInTheDocument();
  });
});
