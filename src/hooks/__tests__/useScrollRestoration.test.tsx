import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { useScrollRestoration } from "../useScrollRestoration";

/**
 * The stored half of `useScrollRestoration`, which the e2e suite cannot pin.
 *
 * `e2e/scroll-restoration.spec.ts` owns the reader-visible half — Back lands on
 * the offset it left — and it fails against a build without the hook. What it
 * cannot hold is the `pagehide` save: proving that needs a reload, and a reload
 * puts the browser's own restore, hydration and this hook in a three-way race
 * whose outcome moves with request timing. Removing the `pagehide` listener and
 * rebuilding, that spec still passed 3 of 3 under Playwright while the same
 * scenario driven through raw Chromium reproduced the defect. A test that green
 * against the broken build is worse than no test, so the save is pinned here
 * instead, where dispatching the event is exact.
 */

const STORAGE_KEY = "scroll-positions";

const stored = () => JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}");

const setScrollY = (y: number) => {
  Object.defineProperty(window, "scrollY", { value: y, writable: true, configurable: true });
};

/**
 * jsdom lays nothing out, so `scrollHeight` is 0 and the hook would wait out
 * its window for a document that never grows. This is the layout the browser
 * would have.
 */
const setScrollHeight = (height: number) => {
  Object.defineProperty(document.documentElement, "scrollHeight", {
    value: height,
    writable: true,
    configurable: true,
  });
};

const Probe = () => {
  useScrollRestoration();
  const navigate = useNavigate();
  return (
    <>
      <Link to="/next">next</Link>
      <button onClick={() => navigate(-1)}>back</button>
    </>
  );
};

const renderAt = (initialEntries: string[] = ["/"]) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<Probe />} />
        <Route path="/next" element={<Probe />} />
      </Routes>
    </MemoryRouter>
  );

/** Long enough for the hook's `requestAnimationFrame` loop to take a turn. */
const aFewFrames = () => act(async () => void (await new Promise((r) => setTimeout(r, 60))));

describe("useScrollRestoration", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setScrollY(0);
    setScrollHeight(0);
    window.innerHeight = 800;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records where the reader was when they navigate away", async () => {
    const { getByText } = renderAt();
    setScrollY(4200);

    await userEvent.click(getByText("next"));

    // `default` is react-router's key for the entry a document opens on, which
    // is the archive in the case this exists for.
    expect(stored().default).toBe(4200);
  });

  it("records where the reader was when the document goes away", async () => {
    renderAt();
    setScrollY(4200);
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });

    // Without this the entry would only ever hold the offset from the last
    // client-side navigation. A reader who came back, read somewhere else and
    // then reloaded would be restored to the stale one — measured at 10084
    // against the 800 they were actually at.
    expect(stored().default).toBe(4200);
  });

  it("restores a stored offset once the document is tall enough to hold it", async () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ default: 5000 }));
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    renderAt();
    // Still the outgoing page's height: nothing to restore into yet.
    await aFewFrames();
    expect(scrollTo, "restored against a document too short to hold the offset").not.toHaveBeenCalled();

    setScrollHeight(6000);
    await aFewFrames();

    expect(scrollTo).toHaveBeenCalledWith(0, 5000);
  });

  it("never moves a reader up to an offset they are already past", async () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ default: 500 }));
    setScrollY(2000);
    setScrollHeight(6000);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    renderAt();
    await aFewFrames();

    // The browser restored further than the stored entry, or the entry is
    // stale. Either way the reader keeps the page they are on.
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("restores on the way back and not on the way out", async () => {
    setScrollHeight(6000);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const { getByText } = renderAt();

    setScrollY(4200);
    await userEvent.click(getByText("next"));
    await aFewFrames();

    // The offset just recorded belongs to the entry being left, and must not
    // follow the reader onto the page they opened. Note this holds without the
    // `navigationType` guard too — a pushed entry has no stored offset to find
    // — so it pins the keying, not that guard, which mirrors `ScrollToTop` and
    // is deliberately belt-and-braces.
    expect(scrollTo, "restored on the way out of a page").not.toHaveBeenCalled();

    // Back onto the entry just left, with the reader's offset gone — which is
    // what a browser that clamped the restore leaves behind.
    setScrollY(0);
    await userEvent.click(getByText("back"));
    await aFewFrames();

    expect(scrollTo).toHaveBeenCalledWith(0, 4200);
  });
});
