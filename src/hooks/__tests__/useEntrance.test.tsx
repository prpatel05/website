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
  const [{ useEntrance, useEntranceGate }, { markMotionFeaturesReady }] = await Promise.all([
    import("../useEntrance"),
    import("@/lib/motion-ready"),
  ]);
  return { useEntrance, useEntranceGate, markMotionFeaturesReady };
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

/**
 * The gate is what keeps an element that the entrance is holding at opacity 0
 * from taking the tap. Its two failure directions are opposite and both bad:
 * never gating (PRA-951's ghost strips), and never releasing.
 */
const renderGateProbe = (
  useEntranceGate: typeof import("../useEntrance").useEntranceGate
) => {
  const Probe = () => {
    const gate = useEntranceGate();

    return (
      <div>
        <span data-testid="style">{JSON.stringify(gate.style ?? null)}</span>
        <button onClick={gate.onAnimationComplete}>complete</button>
        <Link to="/next">next</Link>
      </div>
    );
  };

  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Probe />} />
        {/*
          A distinct key, because the gate reads its starting value once — at
          mount, the same moment framer decides whether to write `initial`.
          Without one React reuses this instance across the route change and
          the probe never sees the mount the real navigation performs.
        */}
        <Route path="/next" element={<Probe key="next" />} />
      </Routes>
    </MemoryRouter>
  );
};

const gateStyle = () => screen.getByTestId("style");

describe("useEntranceGate", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("does not gate an entrance that was never going to run", async () => {
    const { useEntranceGate, markMotionFeaturesReady } = await freshEntrance();
    markMotionFeaturesReady();

    renderGateProbe(useEntranceGate);

    // First load: `useEntrance` returns `false`, nothing is ever hidden, and
    // an element that starts visible must start tappable.
    expect(gateStyle()).toHaveTextContent("null");
  });

  it("gates an element the entrance is about to hide", async () => {
    const { useEntranceGate, markMotionFeaturesReady } = await freshEntrance();
    markMotionFeaturesReady();

    renderGateProbe(useEntranceGate);
    await navigate();

    expect(gateStyle()).toHaveTextContent('{"pointerEvents":"none"}');
  });

  it("releases when the entrance finishes", async () => {
    const { useEntranceGate, markMotionFeaturesReady } = await freshEntrance();
    markMotionFeaturesReady();

    renderGateProbe(useEntranceGate);
    await navigate();
    await userEvent.click(screen.getByRole("button", { name: "complete" }));

    // `null`, not `pointer-events: auto`. An ancestor that has switched its own
    // taps off — the hero column, once `useParallaxFade` has faded it out —
    // does not survive a descendant setting `auto`, so writing one here would
    // hand back the taps PRA-943 took away.
    expect(gateStyle()).toHaveTextContent("null");
  });

  it("does not gate while the animation features are still loading", async () => {
    const { useEntranceGate } = await freshEntrance();

    renderGateProbe(useEntranceGate);
    await navigate();

    // No features means no `initial` was written, so there is nothing hidden
    // to gate — and nothing that would ever fire `onAnimationComplete` to
    // release it again.
    expect(gateStyle()).toHaveTextContent("null");
  });
});
