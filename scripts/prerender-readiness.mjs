/**
 * The waits the prerender does before it starts asserting on a page.
 *
 * All three used to be written as "sample once and hope", and one of them
 * warned instead of failing. On a loaded machine that combination produced a
 * hard build failure with the wrong name on it:
 *
 *     Warning: hydration check timed out for /blog, using fallback wait
 *     Prerender failed: Error: /blog: expected exactly 1 injected modulepreload
 *       for the motion feature chunk, found 0.
 *
 * The modulepreload assertion was correct about what it wanted. It was asked
 * too early — Vite's preload helper injects that link when LazyMotion requests
 * its chunk, which cannot happen on a page that never hydrated. The line that
 * mattered was the warning above it, and the line that failed the build sent
 * the investigator to the chunk instead.
 *
 * So: nothing here samples, and nothing here warns. Each check waits for the
 * state it needs and, if that state never arrives, fails naming itself.
 *
 * Extracted from prerender.mjs so the ordering can be tested against a fake
 * page. Whether a check waits or samples is invisible on an idle machine and
 * shows up only as a flake on a busy one, which is the worst possible place to
 * discover it: `npm run build` is the deploy path for the unattended blog
 * auto-merge routine, and a post that fails to go live there is silent.
 */

/**
 * Generous on purpose. These are readiness waits against a static server on
 * loopback, not performance budgets — the page is ready in well under a second
 * on an idle machine, so the only thing a longer timeout buys is tolerance for
 * a build sharing a machine with `npm install` and the unit suite. The only
 * cost of the extra headroom is paid on builds that were going to fail anyway.
 */
export const READINESS_TIMEOUT_MS = 30_000;

/** Minimum paragraphs a rendered post body has. Below this it did not arrive. */
export const MIN_POST_PARAGRAPHS = 3;

/**
 * Source of the regex matching Vite's emitted motion feature chunk.
 *
 * A string rather than a RegExp because it crosses into the browser as a
 * `page.evaluate` argument, and only structured-cloneable values survive.
 */
export const MOTION_CHUNK_PATTERN = "/assets/motion-features-[^/]*\\.js$";

// The three functions below run inside the page, so they are serialized to
// source and re-evaluated there: they may use browser globals and their
// arguments, and nothing else from this module's scope.

const mainHasContent = () =>
  document.querySelector("#main-content")?.children.length > 0;

/**
 * Paragraphs inside `<article>`, as a value `waitForFunction` can poll on.
 *
 * Reports the count once `min` is reached and 0 before that, so the wait (which
 * polls on truthiness) and the failure message that says how many actually
 * arrived are the same function and cannot drift on the selector. Call it with
 * `min: 1` to read the count unconditionally; `min: 0` would report a genuinely
 * empty article as 0, which is the same answer, so it is never worth waiting on.
 */
const postParagraphs = ({ min }) => {
  const count = document.querySelectorAll("article p").length;
  return count >= min ? count : 0;
};

/**
 * Counts the injected motion-chunk modulepreloads, optionally removing them.
 *
 * One function for both the wait and the strip so the two cannot drift into
 * disagreeing about which links they mean — a wait that matched a superset of
 * what the strip removes would satisfy itself and then fail the count.
 */
const motionPreloads = ({ pattern, remove }) => {
  const links = [...document.querySelectorAll('link[rel="modulepreload"]')].filter(
    (link) => new RegExp(pattern).test(new URL(link.href).pathname)
  );
  if (remove) links.forEach((link) => link.remove());
  return links.length;
};

/** Waits for React to have put something in `#main-content`. */
export async function waitForHydration(page, route, timeout = READINESS_TIMEOUT_MS) {
  try {
    await page.waitForFunction(mainHasContent, undefined, { timeout });
  } catch (cause) {
    // Every check downstream of this one reads a hydrated page. Continuing past
    // a timeout — which is what this used to do — does not degrade gracefully;
    // it just moves the failure to whichever later assertion notices first and
    // relabels it as that assertion's problem.
    throw new Error(
      `${route}: #main-content was still empty after ${timeout}ms — the page ` +
        `never rendered. Nothing after this point would be describing the page ` +
        `you meant to prerender.`,
      { cause }
    );
  }
}

/**
 * Waits for a post's markdown body to be in the DOM.
 *
 * `networkidle` is not enough on its own: it settles when the body's fetch
 * completes, and React commits the resulting state update after that. An empty
 * `<article>` serializes to perfectly valid HTML, so this has to be a wait
 * rather than a check.
 */
export async function waitForPostBody(
  page,
  route,
  timeout = READINESS_TIMEOUT_MS,
  minParagraphs = MIN_POST_PARAGRAPHS
) {
  try {
    await page.waitForFunction(postParagraphs, { min: minParagraphs }, { timeout });
  } catch (cause) {
    // Re-read rather than reporting "fewer than N": 0 paragraphs (the body
    // never arrived) and 2 (it arrived truncated) are different bugs.
    const found = await page.evaluate(postParagraphs, { min: 1 }).catch(() => "an unknown number of");
    throw new Error(
      `${route} rendered ${found} paragraph(s) after ${timeout}ms, expected at ` +
        `least ${minParagraphs} — the post body did not load.`,
      { cause }
    );
  }
}

/**
 * Waits for the injected motion-chunk modulepreload, then strips it.
 *
 * Returns the number removed. The link is an artifact of Vite's preload helper
 * firing on the dynamic import in src/App.tsx; baking it into the snapshot
 * would put the chunk back on the critical path that the dynamic import exists
 * to keep it off.
 */
export async function stripMotionPreload(page, route, timeout = READINESS_TIMEOUT_MS) {
  try {
    await page.waitForFunction(
      motionPreloads,
      { pattern: MOTION_CHUNK_PATTERN, remove: false },
      { timeout }
    );
  } catch (cause) {
    // Reaching here on a page that did hydrate is the real version of the
    // assertion this replaced: the chunk is no longer emitted under this name,
    // or LazyMotion stopped loading it lazily, and either way the strip below
    // is doing nothing.
    throw new Error(
      `${route}: no injected modulepreload matching ${MOTION_CHUNK_PATTERN} ` +
        `appeared within ${timeout}ms. Vite's preload helper injects it when ` +
        `LazyMotion asks for its feature chunk, so either that chunk is no ` +
        `longer emitted as motion-features-*.js or LazyMotion stopped loading ` +
        `it lazily — either way this strip is doing nothing.`,
      { cause }
    );
  }

  const dropped = await page.evaluate(motionPreloads, {
    pattern: MOTION_CHUNK_PATTERN,
    remove: true,
  });

  // The wait above already established there is at least one, so this is the
  // more-than-one case: the chunk is being preloaded from somewhere besides the
  // helper, and the strip is no longer removing a single known artifact.
  if (dropped !== 1) {
    throw new Error(
      `${route}: expected exactly 1 injected modulepreload for the motion ` +
        `feature chunk, found ${dropped}.`
    );
  }

  return dropped;
}
