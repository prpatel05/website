import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Link, Route, Routes } from "react-router-dom";

/**
 * `markMotionFeaturesReady` is a one-way module-level latch — the real chunk
 * only lands once — so each test takes a fresh copy of both modules rather than
 * sharing a flag that whichever test ran first has already flipped.
 */
const freshEntrance = async () => {
  vi.resetModules();
  const [{ useEntrance }, { markMotionFeaturesReady }] = await Promise.all([
    import("../useEntrance"),
    import("@/lib/motion-ready"),
  ]);
  return { useEntrance, markMotionFeaturesReady };
};

const renderProbe = (useEntrance: typeof import("../useEntrance").useEntrance) => {
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

  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Probe />} />
        <Route path="/next" element={<Probe />} />
      </Routes>
    </MemoryRouter>
  );
};

const navigate = () => userEvent.click(screen.getByRole("link", { name: "next" }));
const initialValue = () => screen.getByTestId("initial");

describe("useEntrance", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  // The whole point is that the prerendered markup stays visible: if this ever
  // returns the hidden state on first load, every route ships at opacity 0
  // again and paints only after hydration.
  it("skips the entrance state on the entry the document loaded with", async () => {
    const { useEntrance, markMotionFeaturesReady } = await freshEntrance();
    markMotionFeaturesReady();

    renderProbe(useEntrance);

    expect(initialValue()).toHaveTextContent("false");
  });

  it("restores it once the user navigates", async () => {
    const { useEntrance, markMotionFeaturesReady } = await freshEntrance();
    markMotionFeaturesReady();

    renderProbe(useEntrance);
    await navigate();

    expect(initialValue()).toHaveTextContent('{"opacity":0}');
  });

  // Navigating before the animation features have landed: `m` would write the
  // hidden state into the style and have nothing loaded to animate it away, so
  // the incoming page would sit at opacity 0 until the chunk arrived.
  it("skips the entrance while the animation features are still loading", async () => {
    const { useEntrance } = await freshEntrance();

    renderProbe(useEntrance);
    await navigate();

    expect(initialValue()).toHaveTextContent("false");
  });

  it("picks the entrance back up once the features land", async () => {
    const { useEntrance, markMotionFeaturesReady } = await freshEntrance();

    renderProbe(useEntrance);
    await navigate();
    expect(initialValue()).toHaveTextContent("false");

    // Mounted subscribers re-render off this, so it is a state update.
    act(() => markMotionFeaturesReady());
    await navigate();

    expect(initialValue()).toHaveTextContent('{"opacity":0}');
  });
});
