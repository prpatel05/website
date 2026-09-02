import { describe, it, expect, afterEach } from "vitest";
// Lives in scripts/, outside the vitest `include` glob, so it is imported here
// rather than tested in place.
import {
  MOTION_CHUNK_PATTERN,
  READINESS_TIMEOUT_MS,
  stripMotionPreload,
  waitForHydration,
  waitForPostBody,
} from "../../../scripts/prerender-readiness.mjs";

/**
 * A stand-in for a Playwright `page` over jsdom, whose content arrives late.
 *
 * The defect these functions exist to fix is a race, and a race is not
 * reproducible by running the real thing — two builds of the identical tree
 * passed either side of the one that failed. What *is* testable is the
 * ordering: whether a check reads the page once and rules on whatever it
 * happens to find, or waits for the state it needs to arrive.
 *
 * So the page starts in its loading state and `arrive` runs after the poll it
 * is given, standing in for elapsed time. `waitForFunction` polls the predicate
 * and rejects on exhaustion, which is what Playwright's does; `evaluate` reads
 * the page exactly once, which is the shape being replaced. Both are handed the
 * real functions from the module, running against a real DOM, so the selectors
 * inside them are under test too and not just the control flow.
 */
const fakePage = ({ arriveAtPoll = 0, arrive = () => {} } = {}) => {
  const MAX_POLLS = 10;
  let polls = 0;

  const page = {
    waits: 0,
    evaluations: 0,
    get polls() {
      return polls;
    },
    /** The last options object `waitForFunction` was called with. */
    lastOptions: undefined as { timeout?: number } | undefined,

    evaluate: async (fn: (arg: unknown) => unknown, arg?: unknown) => {
      page.evaluations += 1;
      return fn(arg);
    },

    waitForFunction: async (
      fn: (arg: unknown) => unknown,
      arg?: unknown,
      options?: { timeout?: number }
    ) => {
      page.waits += 1;
      page.lastOptions = options;
      // Playwright evaluates once before it starts polling, so `arriveAtPoll: 0`
      // means "already there on the first look".
      for (let attempt = 0; attempt <= MAX_POLLS; attempt++) {
        const value = fn(arg);
        if (value) return value;
        polls += 1;
        if (polls === arriveAtPoll) arrive();
      }
      throw new Error("Timeout 30000ms exceeded.");
    },
  };

  if (arriveAtPoll === 0) arrive();
  return page;
};

const TIMEOUT = 30_000;

const main = (children: number) => {
  document.body.innerHTML = `<main id="main-content">${"<div></div>".repeat(children)}</main>`;
};

const article = (paragraphs: number) => {
  document.body.innerHTML = `<article>${"<p>x</p>".repeat(paragraphs)}</article>`;
};

const preloads = (hrefs: string[]) => {
  document.head.innerHTML = hrefs
    .map((href) => `<link rel="modulepreload" href="${href}">`)
    .join("");
};

const preloadHrefs = () =>
  [...document.head.querySelectorAll("link")].map((link) => link.getAttribute("href"));

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

describe("prerender readiness waits", () => {
  describe("waitForHydration", () => {
    it("resolves once #main-content has children", async () => {
      main(3);
      const page = fakePage();
      await expect(waitForHydration(page, "/blog", TIMEOUT)).resolves.toBeUndefined();
    });

    it("waits for content that arrives after the first look", async () => {
      main(0);
      const page = fakePage({ arriveAtPoll: 3, arrive: () => main(5) });
      await waitForHydration(page, "/blog", TIMEOUT);
      expect(page.polls).toBeGreaterThan(0);
    });

    it("fails the build naming hydration when the page never renders", async () => {
      // This used to warn and continue. Continuing is what turned a hydration
      // timeout into a modulepreload error three checks further down, sending
      // the investigator to a chunk that was never the problem.
      main(0);
      const page = fakePage();
      await expect(waitForHydration(page, "/blog", TIMEOUT)).rejects.toThrow(
        "/blog: #main-content was still empty after 30000ms"
      );
    });

    it("fails rather than resolving when #main-content is absent entirely", async () => {
      document.body.innerHTML = "<div>no main here</div>";
      const page = fakePage();
      await expect(waitForHydration(page, "/blog", TIMEOUT)).rejects.toThrow(
        "#main-content was still empty"
      );
    });

    it("keeps the underlying timeout as the cause", async () => {
      main(0);
      const page = fakePage();
      const error: Error = await waitForHydration(page, "/blog", TIMEOUT).catch((e) => e);
      expect(error.cause).toBeInstanceOf(Error);
      expect(String(error.cause)).toMatch(/Timeout/);
    });

    it("hands the timeout to the wait it reports", async () => {
      // A message quoting 30000ms over a wait that gave up at 10000ms would be a
      // worse lie than the one this replaced.
      main(1);
      const page = fakePage();
      await waitForHydration(page, "/blog", 12_345);
      expect(page.lastOptions?.timeout).toBe(12_345);
    });
  });

  describe("waitForPostBody", () => {
    it("accepts a body that arrives after the first look", async () => {
      // `networkidle` settles when the markdown fetch completes; React commits
      // the resulting state update after that. Counting at that moment races.
      article(0);
      const page = fakePage({ arriveAtPoll: 2, arrive: () => article(12) });
      await expect(waitForPostBody(page, "/blog/a-post", TIMEOUT)).resolves.toBeUndefined();
      expect(page.polls).toBeGreaterThan(0);
    });

    it("rejects a body that never arrives, reporting what it actually found", async () => {
      // 0 paragraphs (never fetched) and 2 (arrived truncated) are different
      // bugs, so the message re-reads the page rather than saying "fewer than 3".
      article(2);
      const page = fakePage();
      await expect(waitForPostBody(page, "/blog/a-post", TIMEOUT)).rejects.toThrow(
        "/blog/a-post rendered 2 paragraph(s) after 30000ms, expected at least 3"
      );
    });

    it("reports a genuinely empty article as 0", async () => {
      article(0);
      const page = fakePage();
      await expect(waitForPostBody(page, "/blog/a-post", TIMEOUT)).rejects.toThrow(
        "rendered 0 paragraph(s)"
      );
    });

    it("honours a caller-supplied minimum", async () => {
      article(4);
      await expect(waitForPostBody(fakePage(), "/blog/a-post", TIMEOUT, 3)).resolves.toBeUndefined();
      await expect(waitForPostBody(fakePage(), "/blog/a-post", TIMEOUT, 5)).rejects.toThrow(
        "expected at least 5"
      );
    });
  });

  describe("stripMotionPreload", () => {
    const motionChunk = "https://x.test/assets/motion-features-a1b2c3.js";
    const routeChunk = "https://x.test/assets/BlogPost-d4e5f6.js";

    it("removes the injected link and leaves the route's own alone", async () => {
      // BlogPost is needed to hydrate the page it is preloaded on, so there the
      // artifact is doing useful work.
      preloads([motionChunk, routeChunk]);
      await expect(stripMotionPreload(fakePage(), "/blog", TIMEOUT)).resolves.toBe(1);
      expect(preloadHrefs()).toEqual([routeChunk]);
    });

    it("waits for a link injected during hydration instead of finding none", async () => {
      // The reported failure, reproduced. Vite's preload helper injects the link
      // when LazyMotion asks for its chunk, which is after hydration — so a
      // one-shot read on a loaded machine finds 0 and hard-fails the build.
      preloads([routeChunk]);
      const page = fakePage({
        arriveAtPoll: 3,
        arrive: () => preloads([routeChunk, motionChunk]),
      });
      await expect(stripMotionPreload(page, "/blog", TIMEOUT)).resolves.toBe(1);
      expect(page.polls).toBeGreaterThan(0);
      expect(preloadHrefs()).toEqual([routeChunk]);
    });

    it("blames the missing link, not a count, when it never appears", async () => {
      // The old message — "expected exactly 1 ... found 0" — reads as a claim
      // about the chunk. Nothing was ever wrong with the chunk.
      preloads([routeChunk]);
      const error: Error = await stripMotionPreload(fakePage(), "/blog", TIMEOUT).catch((e) => e);
      expect(error.message).toContain(`no injected modulepreload matching ${MOTION_CHUNK_PATTERN}`);
      expect(error.message).toContain("appeared within 30000ms");
      expect(error.message).not.toMatch(/found 0/);
    });

    it("still fails when the chunk is preloaded more than once", async () => {
      // The wait cannot cover this: it is satisfied by the first link. Two means
      // something besides the preload helper is emitting one, and the strip is
      // no longer removing a single known artifact.
      preloads([motionChunk, "https://x.test/assets/motion-features-999999.js"]);
      await expect(stripMotionPreload(fakePage(), "/blog", TIMEOUT)).rejects.toThrow(
        "expected exactly 1 injected modulepreload for the motion feature chunk, found 2"
      );
    });

    it("fails loudly when the chunk stops being named motion-features-*", async () => {
      // Renaming it should fail the build rather than silently baking the
      // preload into every page and putting the chunk back on the critical path.
      preloads(["https://x.test/assets/lazy-motion-a1b2c3.js"]);
      await expect(stripMotionPreload(fakePage(), "/blog", TIMEOUT)).rejects.toThrow(
        "no longer emitted as motion-features-*.js",
      );
    });

    it("ignores a matching href that is not a modulepreload", async () => {
      // The strip is scoped to the helper's own tag. Removing a <link rel=
      // "preload"> someone added deliberately would be a different change.
      document.head.innerHTML = `<link rel="preload" as="script" href="${motionChunk}">`;
      await expect(stripMotionPreload(fakePage(), "/blog", TIMEOUT)).rejects.toThrow(
        "no injected modulepreload matching"
      );
    });
  });

  it("allows enough headroom for a build sharing a machine with the test suite", () => {
    // The failure that prompted this ran straight after `npm install` and the
    // full unit suite. 10s was the old budget, which is not a lot on a loaded
    // runner. These are readiness waits against a static server on loopback, so
    // a longer one only spends time on builds that were going to fail anyway.
    expect(READINESS_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
  });
});
