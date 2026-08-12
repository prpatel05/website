import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { clearReloadMark, reloadOnce } from "../reload-once";

/**
 * The half of the deploy-staleness recovery that no e2e test can reach.
 *
 * Playwright drives a real Chromium with a working `sessionStorage`, so the
 * branch that matters most here — a browser where the mark cannot be stored —
 * is only reachable by taking the store away, which is a thing to do in jsdom.
 * And it is the branch worth pinning: a recovery that cannot record that it
 * happened is a reload loop, which is a worse thing to ship to a reader than
 * any error screen.
 */

const MARK = "test-reload-mark";

/** `location.reload` is not implemented in jsdom, so it is replaced outright. */
const reload = vi.fn();

/** Replaces `sessionStorage` for one test, in the way real browsers break it. */
const breakStorage = (how: "throws-on-access" | "throws-on-write" | "drops-writes") => {
  const broken: Partial<Storage> = {
    getItem: () => null,
    setItem:
      how === "throws-on-write"
        ? () => {
            throw new DOMException("QuotaExceededError");
          }
        : () => {},
    removeItem: () => {},
  };

  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    get() {
      if (how === "throws-on-access") throw new Error("storage is disabled");
      return broken as Storage;
    },
  });
};

let realStorage: PropertyDescriptor | undefined;

beforeEach(() => {
  realStorage ??= Object.getOwnPropertyDescriptor(window, "sessionStorage");
  reload.mockClear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload },
  });
  window.sessionStorage?.clear?.();
});

afterEach(() => {
  if (realStorage) Object.defineProperty(window, "sessionStorage", realStorage);
  window.sessionStorage?.clear?.();
});

describe("reloadOnce", () => {
  it("reloads the first time a mark is asked for", () => {
    expect(reloadOnce(MARK, "decline")).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("declines a mark that has already been spent", () => {
    reloadOnce(MARK, "decline");
    reload.mockClear();

    // The stop. The mark outlives the load it recorded, which is the whole
    // reason it is in `sessionStorage` and not a module variable.
    expect(reloadOnce(MARK, "decline")).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("keeps marks apart", () => {
    reloadOnce(MARK, "decline");
    expect(reloadOnce("a-different-mark", "decline")).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  for (const how of ["throws-on-access", "throws-on-write", "drops-writes"] as const) {
    it(`declines rather than loop when storage ${how}`, () => {
      breakStorage(how);

      expect(reloadOnce(MARK, "decline")).toBe(false);
      expect(reload).not.toHaveBeenCalled();
    });

    it(`still reloads when storage ${how} and the caller terminates anyway`, () => {
      // `recoverPostBody`'s case: after the reload the body comes out of the
      // served HTML and the fetch that failed never runs, so the mark is a
      // second belt rather than the stop. Declining here would cost a reader in
      // a locked-down browser a recovery that works.
      breakStorage(how);

      expect(reloadOnce(MARK, "retry")).toBe(true);
      expect(reload).toHaveBeenCalledTimes(1);
    });
  }
});

describe("clearReloadMark", () => {
  it("makes the recovery available again", () => {
    reloadOnce(MARK, "decline");
    expect(reloadOnce(MARK, "decline")).toBe(false);

    clearReloadMark(MARK);

    expect(reloadOnce(MARK, "decline")).toBe(true);
  });

  it("survives storage that is not there", () => {
    breakStorage("throws-on-access");
    expect(() => clearReloadMark(MARK)).not.toThrow();
  });
});
