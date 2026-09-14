import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { CrtNoiseProvider } from "../CrtNoiseProvider";
import SiteFooter from "../SiteFooter";

vi.mock("@/hooks/useBuildInfo", () => ({
  useBuildInfo: () => ({
    shortSha: "abc1234",
    deployed: "Sep 6, 2026",
    newestTitle: "Newest Post With A Very Long Title Indeed",
    newestSlug: "newest-post",
  }),
}));

describe("SiteFooter", () => {
  it("exposes a compact sitemap and folds status into one contentinfo", () => {
    render(
      <MemoryRouter>
        <CrtNoiseProvider>
          <SiteFooter />
        </CrtNoiseProvider>
      </MemoryRouter>
    );

    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Sitemap" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "rss" })).toHaveAttribute("href", "/rss.xml");
    expect(screen.getByRole("link", { name: "home (sitemap)" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "blog" })).toHaveAttribute("href", "/blog/");
    expect(screen.getByRole("link", { name: "series" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "resume" })).toHaveAttribute("href", "/resume/");
    expect(screen.getByRole("link", { name: "vc" })).toHaveAttribute("href", "/vc/");
    expect(screen.queryByRole("link", { name: "resume.pdf" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "llms.txt" })).not.toBeInTheDocument();
    // Status meta lives inside the same footer (one contentinfo).
    expect(footer.querySelector('[aria-label="Build status"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: /Turn CRT noise on/i })).toBeInTheDocument();
  });
});
