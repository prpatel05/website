import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import PageShell from "../PageShell";

vi.mock("@/hooks/useBuildInfo", () => ({
  useBuildInfo: () => ({
    shortSha: "abc1234",
    deployed: "Sep 6, 2026",
    newestTitle: "Newest Post",
    newestSlug: "newest-post",
  }),
}));

describe("PageShell foot chrome", () => {
  it("keeps footer and status under one border so they do not double-rule", () => {
    const { container } = render(
      <MemoryRouter>
        <PageShell breadcrumbs={[{ label: "blog", to: "/blog/" }]}>
          <main>content</main>
        </PageShell>
      </MemoryRouter>
    );

    expect(screen.getByRole("navigation", { name: "Sitemap" })).toBeInTheDocument();
    expect(screen.getByLabelText("Build status")).toBeInTheDocument();

    const foot = container.querySelector(".border-t.border-border");
    expect(foot).not.toBeNull();
    expect(foot?.querySelector("footer")).not.toBeNull();
    expect(foot?.querySelector('[aria-label="Build status"]')).not.toBeNull();
    // Status itself must not add a second top border.
    expect(foot?.querySelector('[aria-label="Build status"]')?.className).not.toMatch(
      /border-t/
    );
  });
});
