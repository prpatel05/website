import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Link, Route, Routes } from "react-router-dom";
import { useEntrance } from "../useEntrance";

const Probe = () => {
  const entrance = useEntrance();
  const initial = entrance({ opacity: 0 });

  return (
    <div>
      <span data-testid="initial">{JSON.stringify(initial)}</span>
      <Link to="/next">next</Link>
    </div>
  );
};

const app = (
  <MemoryRouter>
    <Routes>
      <Route path="/" element={<Probe />} />
      <Route path="/next" element={<Probe />} />
    </Routes>
  </MemoryRouter>
);

describe("useEntrance", () => {
  // The whole point is that the prerendered markup stays visible: if this ever
  // returns the hidden state on first load, every route ships at opacity 0
  // again and paints only after hydration.
  it("skips the entrance state on the entry the document loaded with", () => {
    render(app);

    expect(screen.getByTestId("initial")).toHaveTextContent("false");
  });

  it("restores it once the user navigates", async () => {
    render(app);

    await userEvent.click(screen.getByRole("link", { name: "next" }));

    expect(screen.getByTestId("initial")).toHaveTextContent('{"opacity":0}');
  });
});
