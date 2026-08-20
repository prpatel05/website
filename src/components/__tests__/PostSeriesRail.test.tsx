import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { SeriesPosition } from "@/lib/blog-series";
import PostSeriesRail from "../PostSeriesRail";

const member = (slug: string, title: string) => ({
  slug,
  title,
  dateISO: "2026-07-01",
  tags: ["agents", "reliability"],
});

const middle: SeriesPosition = {
  name: "Agent reliability",
  current: member("series-b", "Series B Title"),
  previous: member("series-a", "Series A Title"),
  next: member("series-c", "Series C Title"),
  index: 2,
  total: 3,
};

const renderRail = (position: SeriesPosition | null, className?: string) =>
  render(
    <MemoryRouter>
      <PostSeriesRail position={position} className={className} />
    </MemoryRouter>
  );

describe("PostSeriesRail", () => {
  it("renders nothing when the post is not in the series", () => {
    const { container } = renderRail(null);
    expect(container).toBeEmptyDOMElement();
  });

  it("names the series, the position, and the neighbours", () => {
    renderRail(middle);

    const rail = screen.getByRole("navigation", { name: "Agent reliability" });
    expect(rail).toHaveTextContent("// series");
    expect(rail).toHaveTextContent("Agent reliability");
    expect(rail).toHaveTextContent("2 of 3");

    expect(screen.getByRole("link", { name: /previous/ })).toHaveAttribute(
      "href",
      "/blog/series-a/"
    );
    expect(screen.getByRole("link", { name: /next/ })).toHaveAttribute(
      "href",
      "/blog/series-c/"
    );
    expect(screen.queryByRole("link", { name: /Series B Title/ })).toBeNull();
    expect(screen.getByText("Series B Title").closest("[aria-current='page']")).toBeTruthy();
  });

  it("omits previous on the first member", () => {
    renderRail({
      ...middle,
      previous: undefined,
      next: middle.next,
      index: 1,
    });
    expect(screen.queryByRole("link", { name: /previous/ })).toBeNull();
    expect(screen.getByRole("link", { name: /next/ })).toBeInTheDocument();
  });

  it("omits next on the last member", () => {
    renderRail({
      ...middle,
      previous: middle.previous,
      next: undefined,
      index: 3,
    });
    expect(screen.getByRole("link", { name: /previous/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /next/ })).toBeNull();
  });
});
