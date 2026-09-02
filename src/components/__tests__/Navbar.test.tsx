import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The shared mock rather than a local proxy, because the local one built its
// `m.*` components with a plain function and React 18 drops `ref` on those
// silently: `<m.div ref={dialogRef}>` left the ref null, `useFocusTrap` bailed
// on its first line, and the overlay rendered here had no focus trap at all.
// Every keyboard assertion below would have passed against that (PRA-915).
vi.mock("framer-motion", async () => {
  const { createFramerMotionMock } = await import("@/test/framer-motion-mock");
  return createFramerMotionMock();
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

  // --- Keyboard contract ---
  //
  // These two only mean something because the mock forwards `ref`. Under the
  // plain-function proxy this file used to carry, `dialogRef.current` stayed
  // null, `useFocusTrap` returned before binding anything, and both of these
  // would report on an overlay that had no trap. The first is the cheap check
  // that the ref arrived at all; the second is the one to run the negative
  // control on — drop `onEscape` from Navbar.tsx and it has to go red.
  //
  // Focus *restoration* is not asserted here on purpose: it goes through
  // `canTakeFocus`, which asks for `getClientRects().length > 0`, and jsdom
  // reports no boxes for anything. e2e/overlay-a11y.spec.ts owns that half.
  it("moves focus into the overlay when the menu opens", () => {
    render(<Navbar />);
    fireEvent.click(screen.getByText("[menu]"));

    const closeBtn = screen.getByTestId("x-icon").closest("button");
    expect(document.activeElement).toBe(closeBtn);
  });

  it("closes the mobile menu on Escape", () => {
    render(<Navbar />);
    fireEvent.click(screen.getByText("[menu]"));
    expect(screen.getAllByText("about()").length).toBeGreaterThanOrEqual(2);

    // From the focused node, not from `window`: the trap listens on `document`
    // in the capture phase, and an event dispatched *at* `window` visits no
    // node below it.
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });

    expect(screen.getAllByText("about()").length).toBe(1);
  });
});
