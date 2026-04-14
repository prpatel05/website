import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import InteractiveTerminal from "../InteractiveTerminal";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock("framer-motion", () => {
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, prop) => {
        return ({ children, ...props }: Record<string, unknown>) => {
          const htmlProps: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(props)) {
            if (k.startsWith("on") || k === "className" || k === "style" || k === "title" || k === "ref") {
              htmlProps[k] = v;
            }
          }
          const Tag = typeof prop === "string" ? prop : "div";
          return <Tag data-testid={`motion-${String(prop)}`} {...htmlProps}>{children}</Tag>;
        };
      },
    }
  );
  return {
    motion: motionProxy,
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
    fireEvent.keyDown(window, { key: "Escape" });
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
