import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { socials } from "@/data/socials";
import {
  RSS_URL,
  linkedInShareUrl,
  postCanonicalUrl,
  xShareUrl,
} from "@/lib/share-urls";
import PostShare from "../PostShare";

const SLUG = "test-post";
const TITLE = "Test Post Title";
const CANONICAL = postCanonicalUrl(SLUG);

describe("PostShare", () => {
  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers copy, X, LinkedIn, RSS, and the Substack URL from socials", () => {
    render(<PostShare slug={SLUG} title={TITLE} />);

    expect(screen.getByText("// share")).toBeInTheDocument();
    expect(screen.getByText("// subscribe")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "copy url" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "share on x" })).toHaveAttribute(
      "href",
      xShareUrl(CANONICAL, TITLE)
    );
    expect(screen.getByRole("link", { name: "linkedin" })).toHaveAttribute(
      "href",
      linkedInShareUrl(CANONICAL)
    );
    expect(screen.getByRole("link", { name: "rss" })).toHaveAttribute(
      "href",
      RSS_URL
    );

    const substack = socials.find((s) => s.name === "Substack");
    expect(substack).toBeDefined();
    expect(screen.getByRole("link", { name: "substack" })).toHaveAttribute(
      "href",
      substack!.url
    );
  });

  it("opens the off-site share and subscribe exits in a new tab", () => {
    render(<PostShare slug={SLUG} title={TITLE} />);

    for (const name of ["share on x", "linkedin", "substack"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(screen.getByRole("link", { name: "rss" })).not.toHaveAttribute(
      "target"
    );
  });

  it("copies the canonical production URL and confirms briefly", async () => {
    render(<PostShare slug={SLUG} title={TITLE} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "copy url" }));
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(CANONICAL);
    expect(screen.getByRole("button", { name: "copied" })).toBeInTheDocument();
    expect(
      screen.getByText("copied", { selector: "[aria-live='polite']" })
    ).toBeInTheDocument();
  });

  it("does not confirm when the clipboard write fails", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<PostShare slug={SLUG} title={TITLE} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "copy url" }));
    });

    expect(screen.getByRole("button", { name: "copy url" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "copied" })).toBeNull();
  });

  it("returns the copy control to its idle label after the confirmation", async () => {
    vi.useFakeTimers();
    render(<PostShare slug={SLUG} title={TITLE} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "copy url" }));
    });
    expect(screen.getByRole("button", { name: "copied" })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("button", { name: "copy url" })).toBeInTheDocument();
  });
});
