import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SectionJumpRail from "../SectionJumpRail";

vi.mock("@/hooks/useActiveHeading", () => ({
  useActiveHeading: () => "about",
}));

describe("SectionJumpRail", () => {
  beforeEach(() => {
    document.body.innerHTML = '<section id="about"></section>';
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("stays hidden while about is still below mid-viewport", () => {
    const about = document.getElementById("about")!;
    about.getBoundingClientRect = () =>
      ({ top: 500, bottom: 900, left: 0, right: 0, width: 0, height: 400, x: 0, y: 500, toJSON() {} });
    render(<SectionJumpRail />);
    expect(screen.queryByRole("navigation", { name: "On this page" })).toBeNull();
  });

  it("appears once about reaches the nav and marks the active section", () => {
    const about = document.getElementById("about")!;
    about.getBoundingClientRect = () =>
      ({ top: 40, bottom: 440, left: 0, right: 0, width: 0, height: 400, x: 0, y: 100, toJSON() {} });
    render(<SectionJumpRail />);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(screen.getByRole("navigation", { name: "On this page" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "about" })).toHaveAttribute(
      "aria-current",
      "location"
    );
  });
});
