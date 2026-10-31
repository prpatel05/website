import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

vi.mock("framer-motion", async () => {
  const { createFramerMotionMock } = await import("@/test/framer-motion-mock");
  return createFramerMotionMock();
});

vi.mock("react-helmet-async", () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="helmet">{children}</div>
  ),
  HelmetProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

type Handler = () => void;
const calls: unknown[][] = [];
const handlers: Record<string, Handler> = {};
const getCalApi = vi.fn(async () => {
  // Like the real loader: embed.js goes into <head> on first use.
  if (!document.querySelector('script[src="https://app.cal.com/embed/embed.js"]')) {
    const s = document.createElement("script");
    s.src = "https://app.cal.com/embed/embed.js";
    document.head.appendChild(s);
  }
  return (...args: unknown[]) => {
    calls.push(args);
    const [method, opts] = args as [string, { action?: string; callback?: Handler }];
    if (method === "on" && opts.action && opts.callback) handlers[opts.action] = opts.callback;
  };
});
vi.mock("@calcom/embed-react", () => ({ getCalApi }));

async function renderBook() {
  const { default: Book } = await import("../Book");
  return render(
    <MemoryRouter initialEntries={["/book/"]}>
      <Book />
    </MemoryRouter>
  );
}

const stateOf = (container: HTMLElement) =>
  container.querySelector("[data-cal-state]")?.getAttribute("data-cal-state");

describe("Book page", () => {
  beforeEach(() => {
    // CalEmbed remembers a failed script per page load; each test is a fresh load.
    vi.resetModules();
    calls.length = 0;
    for (const k of Object.keys(handlers)) delete handlers[k];
    getCalApi.mockClear();
    document.head.querySelectorAll("script[src*='cal.com']").forEach((s) => s.remove());
    delete window.__PRERENDER__;
  });

  afterEach(() => {
    delete window.__PRERENDER__;
  });

  it("renders the heading, copy, SEO and a plain cal.com link", async () => {
    await renderBook();
    expect(screen.getByRole("heading", { level: 1, name: "Book time with me" })).toBeInTheDocument();
    expect(
      screen.getByText("30 minutes on agents, architecture, or whatever you are building.")
    ).toBeInTheDocument();
    const fallback = screen.getByTestId("cal-fallback-link");
    expect(fallback).toHaveAttribute("href", "https://cal.com/prpatel05/30min");
    expect(fallback).toHaveAttribute("rel", "noopener noreferrer");

    const helmet = screen.getByTestId("helmet");
    expect(helmet.querySelector("title")?.textContent).toBe("Book a Call — Pratik Patel");
    expect(helmet.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://pratik.pa.tel/book/"
    );
  });

  it("mounts the inline embed for prpatel05/30min in the site's dark theme", async () => {
    const { container } = await renderBook();
    await waitFor(() => expect(calls.some(([m]) => m === "inline")).toBe(true));
    expect(getCalApi).toHaveBeenCalledWith({ namespace: "30min" });

    const inline = calls.find(([m]) => m === "inline")?.[1] as {
      calLink: string;
      elementOrSelector: HTMLElement;
      config: Record<string, string>;
    };
    expect(inline.calLink).toBe("prpatel05/30min");
    expect(inline.elementOrSelector).toBe(screen.getByTestId("cal-inline"));
    expect(inline.config.theme).toBe("dark");

    const ui = calls.find(([m]) => m === "ui")?.[1] as {
      theme: string;
      cssVarsPerTheme: { dark: Record<string, string> };
    };
    expect(ui.theme).toBe("dark");
    expect(ui.cssVarsPerTheme.dark["cal-brand"]).toBe("#00ffaa");

    expect(stateOf(container)).toBe("loading");
    expect(screen.getByText(/Loading the calendar/)).toBeInTheDocument();

    act(() => handlers.linkReady());
    expect(stateOf(container)).toBe("ready");
    expect(screen.queryByText(/Loading the calendar/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Open cal\.com/ })).not.toBeInTheDocument();
  });

  it("points at cal.com when Cal reports the link failed", async () => {
    const { container } = await renderBook();
    await waitFor(() => expect(handlers.linkFailed).toBeDefined());
    act(() => handlers.linkFailed());
    expect(stateOf(container)).toBe("failed");
    expect(screen.getByRole("alert")).toHaveTextContent(/did not load/);
    expect(screen.queryByText(/Loading the calendar/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open cal.com/prpatel05/30min" })).toHaveAttribute(
      "href",
      "https://cal.com/prpatel05/30min"
    );
  });

  it("points at cal.com when embed.js itself is blocked", async () => {
    const { container } = await renderBook();
    await waitFor(() => expect(calls.some(([m]) => m === "inline")).toBe(true));
    const script = document.querySelector('script[src="https://app.cal.com/embed/embed.js"]');
    act(() => {
      script?.dispatchEvent(new Event("error"));
    });
    expect(stateOf(container)).toBe("failed");
  });

  it("does not load Cal during prerender", async () => {
    window.__PRERENDER__ = true;
    const { container } = await renderBook();
    await new Promise((r) => setTimeout(r, 20));
    expect(getCalApi).not.toHaveBeenCalled();
    expect(stateOf(container)).toBe("idle");
    expect(screen.getByRole("status")).toHaveTextContent("The calendar opens here.");
    expect(screen.getByRole("link", { name: "Open cal.com/prpatel05/30min" })).toHaveAttribute(
      "href",
      "https://cal.com/prpatel05/30min"
    );
    expect(screen.getByTestId("cal-fallback-link")).toBeInTheDocument();
  });
});
