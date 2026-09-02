import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense } from "react";
import { render, screen } from "@testing-library/react";
import { lazyRoute } from "../lazy-route";
import { clearReloadMark, reloadOnce } from "../reload-once";

/**
 * The recovery itself is mocked. What it does — reload, and refuse to do it
 * twice — is `reload-once`'s own subject, and driving a real page load is not
 * something jsdom has. What is tested here is the half `lazyRoute` owns: that
 * it asks, that it asks with the right mark, and what it renders while the
 * answer is yes or no.
 */
vi.mock("../reload-once", () => ({
  reloadOnce: vi.fn(),
  clearReloadMark: vi.fn(),
}));

const Loaded = () => <p>loaded</p>;

describe("lazyRoute", () => {
  beforeEach(() => {
    vi.mocked(reloadOnce).mockReset();
    vi.mocked(clearReloadMark).mockReset();
  });

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

  it("releases the recovery mark when the chunk arrives", async () => {
    // So a reader who sits through a second deploy in the same tab gets the
    // recovery a second time.
    const Route = lazyRoute(() => Promise.resolve({ default: Loaded }));
    await Route.preload();

    expect(clearReloadMark).toHaveBeenCalledWith("route-chunk-reload");
  });

  it("recovers a failed import with a full load instead of the error screen", async () => {
    vi.mocked(reloadOnce).mockReturnValue(true);
    const Route = lazyRoute(() => Promise.reject(new Error("chunk gone")));
    await Route.preload();

    // Nothing, rather than a throw the ErrorBoundary would turn into "Something
    // went wrong": the browser is on its way to a full load of this same URL,
    // which serves the route prerendered.
    const { container } = render(<Route />);
    expect(container).toBeEmptyDOMElement();

    // "decline", not "retry": after the reload this import runs again from
    // `main.tsx`, so a browser that cannot record the mark must not reload at
    // all rather than reload forever.
    expect(reloadOnce).toHaveBeenCalledTimes(1);
    expect(reloadOnce).toHaveBeenCalledWith("route-chunk-reload", "decline");
  });

  it("asks for the recovery once however many times it renders", async () => {
    vi.mocked(reloadOnce).mockReturnValue(true);
    const Route = lazyRoute(() => Promise.reject(new Error("chunk gone")));
    await Route.preload();

    render(<Route />);
    render(<Route />);
    render(<Route />);

    expect(reloadOnce).toHaveBeenCalledTimes(1);
  });

  it("throws a failed import from render once the recovery is spent", async () => {
    // Held rather than rethrown from `preload` so that Suspense is not left
    // retrying a promise that can only ever reject. This is the terminal state:
    // the reload already happened and the chunk is still gone, so the reader
    // gets the error screen and its refresh button rather than another reload.
    vi.mocked(reloadOnce).mockReturnValue(false);
    const Route = lazyRoute(() => Promise.reject(new Error("chunk gone")));
    await Route.preload();

    expect(() => render(<Route />)).toThrow("chunk gone");
  });
});
