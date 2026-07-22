import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useMotionValue } from "framer-motion";
import { useParallax } from "../useParallax";

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
