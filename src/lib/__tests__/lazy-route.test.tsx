import { describe, it, expect, vi } from "vitest";
import { Suspense } from "react";
import { render, screen } from "@testing-library/react";
import { lazyRoute } from "../lazy-route";

const Loaded = () => <p>loaded</p>;

describe("lazyRoute", () => {
  it("renders synchronously once preloaded, without suspending", async () => {
    // The whole reason this exists instead of `React.lazy`: hydration cannot
    // survive a boundary that suspends, so after `preload()` the first render
    // has to produce the component itself rather than a thrown promise. The
    // assertion is that no Suspense boundary is needed at all.
    const Route = lazyRoute(() => Promise.resolve({ default: Loaded }));
    await Route.preload();

    render(<Route />);
    expect(screen.getByText("loaded")).toBeInTheDocument();
  });

  it("suspends when it has not been preloaded", async () => {
    const Route = lazyRoute(() => Promise.resolve({ default: Loaded }));

    render(
      <Suspense fallback={<p>waiting</p>}>
        <Route />
      </Suspense>
    );

    expect(screen.getByText("waiting")).toBeInTheDocument();
    expect(await screen.findByText("loaded")).toBeInTheDocument();
  });

  it("loads the module once however many times preload is called", async () => {
    const load = vi.fn(() => Promise.resolve({ default: Loaded }));
    const Route = lazyRoute(load);

    await Promise.all([Route.preload(), Route.preload(), Route.preload()]);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("throws a failed import from render, for the error boundary", async () => {
    // Held rather than rethrown from `preload` so that Suspense is not left
    // retrying a promise that can only ever reject.
    const Route = lazyRoute(() => Promise.reject(new Error("chunk gone")));
    await Route.preload();

    expect(() => render(<Route />)).toThrow("chunk gone");
  });
});
