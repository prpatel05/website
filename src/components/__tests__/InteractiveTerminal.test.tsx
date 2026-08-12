import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import InteractiveTerminal from "../InteractiveTerminal";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

// The `ref` on the terminal's overlay is what `useFocusTrap` traps, so the mock
// has to forward it — see `@/test/framer-motion-mock` for what a plain function
// component costs here.
vi.mock("framer-motion", async () => {
  const { createFramerMotionMock } = await import("@/test/framer-motion-mock");
  return createFramerMotionMock();
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
