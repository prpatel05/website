import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useMotionValue } from "framer-motion";
import { useParallax, useParallaxFade } from "../useParallax";

// framer-motion caches the media-query result the first time anything asks for
// it, so flipping `window.matchMedia` between tests would not be seen. The
// contract this hook owns is what it does with the answer, not how framer
// reads it.
const prefersReducedMotion = { value: false };

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => prefersReducedMotion.value,
}));

const Probe = () => {
  const progress = useMotionValue(0.5);
  const y = useParallax(progress, [0, 1], ["0%", "30%"]);

  return <span data-testid="offset">{y === undefined ? "none" : y.get()}</span>;
};

beforeEach(() => {
  prefersReducedMotion.value = false;
});

describe("useParallax", () => {
  it("tracks scroll progress when motion is welcome", () => {
    render(<Probe />);
    expect(screen.getByTestId("offset")).toHaveTextContent("15%");
  });

  it("drops the transform entirely under prefers-reduced-motion", () => {
    prefersReducedMotion.value = true;
    render(<Probe />);
    expect(screen.getByTestId("offset")).toHaveTextContent("none");
  });
});

const FadeProbe = ({ at }: { at: number }) => {
  const progress = useMotionValue(at);
  const fade = useParallaxFade(progress, [0, 0.8], [1, 0]);

  if (fade.opacity === undefined) return <span data-testid="fade">none</span>;
  return (
    <span data-testid="fade">
      {`${fade.opacity.get().toFixed(2)}|${fade.pointerEvents?.get()}|${fade.visibility?.get()}`}
    </span>
  );
};

describe("useParallaxFade", () => {
  it("leaves a fade the reader can still see interactive", () => {
    render(<FadeProbe at={0} />);
    expect(screen.getByTestId("fade")).toHaveTextContent("1.00|auto|visible");
  });

  it("keeps a half-faded element tappable", () => {
    // 0.25 opacity is dim, but it is on screen and a reader can aim at it. A
    // gate that fires here would take away a tap that was meant.
    render(<FadeProbe at={0.6} />);
    expect(screen.getByTestId("fade")).toHaveTextContent("0.25|auto|visible");
  });

  it("stops taking taps once the element is a ghost", () => {
    render(<FadeProbe at={0.76} />);
    expect(screen.getByTestId("fade")).toHaveTextContent("0.05|none|hidden");
  });

  it("stays shut past the end of the range", () => {
    // The gate reads `progress`, and `transform()` clamps, so it holds at 0
    // beyond the input range. The painted opacity does not: framer drives it
    // from a ViewTimeline that rebounds towards 1 past progress 0.8. Without
    // the clamp the CTAs would become hit targets again on the way out.
    render(<FadeProbe at={1} />);
    expect(screen.getByTestId("fade")).toHaveTextContent("0.00|none|hidden");
  });

  it("binds nothing at all under prefers-reduced-motion", () => {
    // Not "gated shut" — absent. The fade never runs for these readers, so the
    // element stays fully opaque, and hiding it would be the defect.
    prefersReducedMotion.value = true;
    render(<FadeProbe at={1} />);
    expect(screen.getByTestId("fade")).toHaveTextContent("none");
  });
});
