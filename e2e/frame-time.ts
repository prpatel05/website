import { expect, type Page } from "@playwright/test";

/**
 * Advances a budget of *animation* time, which is not the same quantity as the
 * same number of milliseconds of wall clock and is the one an entrance actually
 * runs on.
 *
 * framer steps a tween from `requestAnimationFrame`, so its progress is
 * denominated in frames the page produced, not in seconds that passed. Those
 * come apart: the page under test intermittently stops producing frames
 * entirely while Playwright is sleeping, and a tween cannot advance through a
 * gap it is never called back in.
 *
 * Measured at 393x852 over 30 arrivals, comparing `document.timeline.currentTime`
 * — which only moves when a frame is produced — against `performance.now()`
 * across a 2400ms `waitForTimeout`. 28 of them produced 2400ms of frames for
 * 2404ms of wall clock. Two did not: one got 933ms of frames in 3493ms, and one
 * got **383ms in 2417ms**, a 2033ms stall in which framer wrote no style at all
 * and the card was still at `opacity: 0` with `pointer-events: none` when the
 * assertion read it. That is PRA-993.
 *
 * Waiting on frames rather than on the clock is not merely a longer wait: a
 * pending `requestAnimationFrame` is itself what keeps the page producing
 * frames, so the starvation does not happen, and the budget the entrance is
 * given is the same one it was always meant to get. The assertion keeps all its
 * strength — an animation that never lands still runs the budget out and still
 * fails.
 *
 * Nothing here is a defect the reader can hit. A browser that is painting for
 * someone produces frames, and a stalled entrance fails safe in any case: the
 * element stays invisible *and* untapped, which is the contract, not the
 * breach. The starvation is Chromium going idle behind a sleeping test runner.
 */
export async function advanceFrameTime(page: Page, ms: number) {
  return page.evaluate(async (budget) => {
    const wall0 = performance.now();
    const frame0 = Number(document.timeline.currentTime);
    // A ceiling, so a page that genuinely never paints again fails with the
    // reading below instead of hanging until Playwright's own timeout.
    const deadline = wall0 + budget * 4;

    await new Promise<void>((resolve) => {
      const tick = () => {
        if (
          Number(document.timeline.currentTime) - frame0 >= budget ||
          performance.now() >= deadline
        ) {
          resolve();
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });

    return {
      wall: Math.round(performance.now() - wall0),
      framed: Math.round(Number(document.timeline.currentTime) - frame0),
    };
  }, ms);
}

/**
 * `advanceFrameTime` plus the assertion that the frames actually arrived, so a
 * starved page fails saying so instead of failing as whatever the animation
 * happened to be reading mid-flight.
 */
export async function settleFrames(page: Page, ms: number) {
  const budget = await advanceFrameTime(page, ms);

  expect(
    budget.framed,
    `the page produced only ${budget.framed}ms of frames in ${budget.wall}ms of wall clock, so an animation stepped from requestAnimationFrame has not had its ${ms}ms and anything read now is mid-animation`
  ).toBeGreaterThanOrEqual(ms);
}
