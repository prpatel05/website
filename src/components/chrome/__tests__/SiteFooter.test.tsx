import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import SiteFooter from "../SiteFooter";

describe("SiteFooter", () => {
  it("exposes sitemap links including rss and llms.txt", () => {
    render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>
    );

    expect(screen.getByRole("navigation", { name: "Sitemap" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "rss" })).toHaveAttribute("href", "/rss.xml");
    expect(screen.getByRole("link", { name: "llms.txt" })).toHaveAttribute(
      "href",
      "/llms.txt"
    );
    expect(screen.getByRole("link", { name: "home (sitemap)" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "blog" })).toHaveAttribute("href", "/blog/");
    expect(screen.getByRole("link", { name: /series/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "resume" })).toHaveAttribute(
      "href",
      "/resume/"
    );
    expect(screen.getByRole("link", { name: "resume.pdf" })).toBeInTheDocument();
  });
});
