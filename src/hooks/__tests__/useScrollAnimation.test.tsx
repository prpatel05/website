import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Link, Route, Routes } from "react-router-dom";
import { useScrollAnimation } from "../useScrollAnimation";

// framer-motion caches the media-query result the first time anything asks for
// it, so flipping `window.matchMedia` between tests would not be seen. The
// contract this hook owns is what it does with the answer, not how framer
// reads it. Same shape as useParallax's test.
const prefersReducedMotion = { value: false };

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => prefersReducedMotion.value,
}));

const Probe = () => {
  const { ref, sectionOpacity } = useScrollAnimation();

  return (
    <section ref={ref}>
      <span data-testid="opacity">
        {sectionOpacity === undefined ? "none" : String(sectionOpacity.get())}
      </span>
      <Link to="/next">next</Link>
    </section>
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

beforeEach(() => {
  prefersReducedMotion.value = false;
});

describe("useScrollAnimation", () => {
  // The transform is driven by scrollYProgress, which is 0 for any section
  // below the fold — so on first load it evaluates to a literal 0 and
  // framer-motion writes `opacity: 0` into the inline style, which the
  // prerender then captures. That shipped the homepage's About, Recent writes
  // and Contact sections blank until React had downloaded and hydrated.
  it("leaves opacity off the element on the entry the document loaded with", () => {
    render(app);

    expect(screen.getByTestId("opacity")).toHaveTextContent("none");
  });

  it("restores the scroll fade once the user navigates", async () => {
    render(app);
    await userEvent.click(screen.getByRole("link", { name: "next" }));

    expect(screen.getByTestId("opacity")).not.toHaveTextContent("none");
  });

  // A scroll-linked value bound straight into `style` is not an animation as
  // far as `MotionConfig reducedMotion="user"` is concerned, so without this
  // these sections kept fading with the scrollbar for exactly the people who
  // asked them not to.
  it("drops the fade entirely under prefers-reduced-motion", async () => {
    prefersReducedMotion.value = true;
    render(app);
    await userEvent.click(screen.getByRole("link", { name: "next" }));

    expect(screen.getByTestId("opacity")).toHaveTextContent("none");
  });
});
