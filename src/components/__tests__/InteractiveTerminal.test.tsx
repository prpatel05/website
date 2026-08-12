import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import InteractiveTerminal from "../InteractiveTerminal";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock("framer-motion", async () => {
  const { forwardRef } = await vi.importActual<typeof import("react")>("react");

  // `forwardRef`, because the overlay's `ref` is not decoration here: it is what
  // `useFocusTrap` traps, and on React 18 a plain function component silently
  // drops it. Without this the mocked terminal has no focus trap at all, which
  // is how "closes terminal on Escape" went on passing after Escape moved into
  // the trap (PRA-912) — against a component that no longer had one.
  //
  // Cached per tag, because the proxy is read on every render and a fresh
  // component identity each time remounts the subtree — which would re-run the
  // trap's open/restore cycle on every state change.
  const tags = new Map<string, ReturnType<typeof forwardRef>>();
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, prop) => {
        const name = typeof prop === "string" ? prop : "div";
        if (!tags.has(name)) {
          tags.set(
            name,
            forwardRef<HTMLElement, Record<string, unknown>>(({ children, ...props }, ref) => {
              const htmlProps: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(props)) {
                if (k.startsWith("on") || k === "className" || k === "style" || k === "title") {
                  htmlProps[k] = v;
                }
              }
              const Tag = name as "div";
              return (
                <Tag ref={ref as React.Ref<HTMLDivElement>} data-testid={`motion-${name}`} {...htmlProps}>
                  {children}
                </Tag>
              );
            })
          );
        }
        return tags.get(name);
      },
    }
  );
  return {
    m: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

function renderTerminal() {
  return render(
    <MemoryRouter>
      <InteractiveTerminal />
    </MemoryRouter>
  );
}

describe("InteractiveTerminal – UI interactions", () => {
  it("shows toggle button and opens terminal on click", () => {
    renderTerminal();
    const btn = screen.getByTitle("Open terminal (Ctrl+K)");
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.getByPlaceholderText(/type "help"/i)).toBeInTheDocument();
  });

  it("opens terminal via Ctrl+K keyboard shortcut", () => {
    renderTerminal();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByPlaceholderText(/type "help"/i)).toBeInTheDocument();
  });

  it("closes terminal on Escape", () => {
    renderTerminal();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByPlaceholderText(/type "help"/i)).toBeInTheDocument();
    // Dispatched on `document`, unlike the Ctrl+K above. Escape belongs to the
    // focus trap now (PRA-912), which listens on `document` so that only the
    // overlay on top answers it — a real keydown targets the focused element
    // and propagates through there, but an event dispatched *at* `window` never
    // visits any node below it.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByPlaceholderText(/type "help"/i)).not.toBeInTheDocument();
  });

  it("toggles terminal with repeated Ctrl+K", () => {
    renderTerminal();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByPlaceholderText(/type "help"/i)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByPlaceholderText(/type "help"/i)).not.toBeInTheDocument();
  });

  it("shows welcome messages on open", () => {
    renderTerminal();
    fireEvent.click(screen.getByTitle("Open terminal (Ctrl+K)"));
    expect(screen.getByText("Welcome to pratik.pa.tel v3.0.1")).toBeInTheDocument();
    expect(screen.getByText('Type "help" for available commands.')).toBeInTheDocument();
  });

  it("renders terminal title bar", () => {
    renderTerminal();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByText("pratik.pa.tel — bash")).toBeInTheDocument();
  });

  it("renders input with prompt", () => {
    renderTerminal();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByText("$")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/type "help"/i)).toBeInTheDocument();
  });
});
