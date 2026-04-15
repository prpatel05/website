import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("framer-motion", () => {
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, prop) => {
        return ({ children, ...props }: Record<string, unknown>) => {
          const htmlProps: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(props)) {
            if (k.startsWith("on") || k === "className" || k === "style" || k === "href" || k === "target" || k === "rel") {
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

vi.mock("lucide-react", () => ({
  Terminal: () => <span data-testid="terminal-icon" />,
  X: () => <span data-testid="x-icon" />,
}));

import Navbar from "../Navbar";

describe("Navbar", () => {
  let scrollY: number;

  beforeEach(() => {
    scrollY = 0;
    Object.defineProperty(window, "scrollY", {
      get: () => scrollY,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the site name and navigation links", () => {
    render(<Navbar />);
    expect(screen.getByText("pratik.pa.tel")).toBeInTheDocument();
    expect(screen.getByText("about()")).toBeInTheDocument();
    expect(screen.getByText("writing()")).toBeInTheDocument();
    expect(screen.getByText("contact()")).toBeInTheDocument();
    expect(screen.getByText("resume()")).toBeInTheDocument();
  });

  it("renders correct href attributes for links", () => {
    render(<Navbar />);
    expect(screen.getByText("about()").closest("a")).toHaveAttribute("href", "#about");
    expect(screen.getByText("writing()").closest("a")).toHaveAttribute("href", "#writing");
    expect(screen.getByText("contact()").closest("a")).toHaveAttribute("href", "#contact");
  });

  it("marks resume link as external", () => {
    render(<Navbar />);
    const resumeLink = screen.getByText("resume()").closest("a");
    expect(resumeLink).toHaveAttribute("target", "_blank");
    expect(resumeLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not apply scrolled styles initially", () => {
    render(<Navbar />);
    const nav = screen.getByText("pratik.pa.tel").closest("nav");
    expect(nav?.className).not.toContain("backdrop-blur");
  });

  it("applies scrolled styles after scrolling past 50px", () => {
    render(<Navbar />);
    scrollY = 100;
    fireEvent.scroll(window);
    const nav = screen.getByText("pratik.pa.tel").closest("nav");
    expect(nav?.className).toContain("backdrop-blur");
    expect(nav?.className).toContain("border-b");
  });

  it("removes scrolled styles when scrolling back up", () => {
    render(<Navbar />);
    scrollY = 100;
    fireEvent.scroll(window);

    scrollY = 10;
    fireEvent.scroll(window);

    const nav = screen.getByText("pratik.pa.tel").closest("nav");
    expect(nav?.className).not.toContain("backdrop-blur");
  });

  // --- Mobile menu ---
  it("shows mobile menu button", () => {
    render(<Navbar />);
    expect(screen.getByText("[menu]")).toBeInTheDocument();
  });

  it("opens mobile overlay on menu button click", () => {
    render(<Navbar />);
    fireEvent.click(screen.getByText("[menu]"));
    // In the overlay, links appear as large text
    const overlayLinks = screen.getAllByText("about()");
    expect(overlayLinks.length).toBeGreaterThanOrEqual(2); // nav + overlay
  });

  it("closes mobile menu when a link is clicked", () => {
    render(<Navbar />);
    fireEvent.click(screen.getByText("[menu]"));

    // The overlay has links; click one
    const overlayLinks = screen.getAllByText("about()");
    const overlayLink = overlayLinks[overlayLinks.length - 1];
    fireEvent.click(overlayLink);

    // After clicking, overlay should close — only the nav link remains
    const remaining = screen.getAllByText("about()");
    expect(remaining.length).toBe(1);
  });

  it("closes mobile menu via X button", () => {
    render(<Navbar />);
    fireEvent.click(screen.getByText("[menu]"));

    const closeBtn = screen.getByTestId("x-icon").closest("button");
    fireEvent.click(closeBtn!);

    const remaining = screen.getAllByText("about()");
    expect(remaining.length).toBe(1);
  });
});
