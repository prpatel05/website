import {
  test,
  expect,
  TERMINAL_TOGGLE,
  type Page,
} from "./fixtures";

/**
 * The two overlays a reader opens for themselves — the terminal and the mobile
 * menu — measured inside the window where the animation feature chunk has not
 * landed yet.
 *
 * `e2e/motion-features-late` covers the same window for a *route* entrance.
 * This is the other half: an element that mounts because of a click rather than
 * a navigation. Both overlays shipped ungated, writing framer's `initial`
 * straight into the inline style with nothing loaded to animate it away.
 *
 * The terminal's window was not a race but a certainty. `index.html` holds a
 * pre-hydration Ctrl+K and `InteractiveTerminal` claims it in a mount-only
 * effect, so that overlay opens on the very first commit — always before a
 * dynamically imported chunk can have resolved. The focus trap then put the
 * caret in the input, and the reader typed into a dialog they could not see.
 *
 * None of the existing overlay specs could catch it: every one of them gates on
 * `toBeVisible()`, which is true at `opacity: 0`. Everything here is measured as
 * computed opacity instead.
 */

const FEATURES_CHUNK = /\/assets\/motion-features-[^/]*\.js$/;

const TERMINAL = { role: "dialog" as const, name: "Interactive terminal" };
const MENU = { role: "dialog" as const, name: "Site menu" };

/**
 * Opacity is multiplied down the ancestor chain, so one element's computed
 * value does not decide whether the reader can see it — an opaque dialog inside
 * a transparent wrapper is still an invisible dialog.
 *
 * A detached node throws rather than returning a number: `getComputedStyle` on
 * one returns `""` for every property and `Number("")` is 0, which is
 * indistinguishable from a genuinely invisible overlay. Throwing turns that
 * into a poll retry instead of a false failure.
 */
const effectiveOpacity = (locator: ReturnType<Page["getByRole"]>) =>
  locator.evaluate((el) => {
    if (!document.body.contains(el)) {
      throw new Error("the overlay is detached — nothing to measure yet");
    }

    let opacity = 1;
    for (
      let node: Element | null = el;
      node && node !== document.documentElement;
      node = node.parentElement
    ) {
      opacity *= Number(getComputedStyle(node).opacity);
    }
    return opacity;
  });

/**
 * Blocks the feature chunk for the duration of `body`, and refuses to let the
 * test pass unless the chunk was actually requested.
 *
 * Without that control this whole file would go green against a build that
 * stopped splitting the chunk out at all — there would be no window left to
 * test, and every assertion would be measuring an ordinary loaded page.
 */
async function withFeaturesHeld(page: Page, body: () => Promise<void>) {
  let released: () => void = () => {};
  const hold = new Promise<void>((resolve) => {
    released = resolve;
  });

  let heldTheChunk = false;
  await page.route(FEATURES_CHUNK, async (route) => {
    heldTheChunk = true;
    await hold;
    await route.continue();
  });

  try {
    await page.goto("/");
    await body();
    expect(
      heldTheChunk,
      "no request for motion-features-*.js — the chunk is not lazily loaded, so this test proved nothing"
    ).toBe(true);
  } finally {
    released();
  }
}

/**
 * Asserts the overlay is opaque now and stays opaque, with the chunk still
 * blocked throughout.
 *
 * Polled first because `AnimatePresence` takes a beat to attach the incoming
 * element, then read again after a pause: the defect pins the overlay at 0 for
 * as long as the chunk is held, so a single satisfying sample early on would
 * not distinguish a fix from a lucky frame.
 */
async function expectOpaqueAndStays(
  page: Page,
  target: { role: "dialog"; name: string }
) {
  const overlay = page.getByRole(target.role, { name: target.name });
  await expect(overlay).toBeAttached();

  await expect
    .poll(() => effectiveOpacity(overlay), {
      message: `the ${target.name} overlay is transparent while the feature chunk is blocked`,
    })
    .toBe(1);

  await page.waitForTimeout(500);
  expect(
    await effectiveOpacity(overlay),
    `the ${target.name} overlay went transparent again while the feature chunk stayed blocked`
  ).toBe(1);
}

test.describe("overlays opened before the motion features land", () => {
  test("the terminal is readable while the feature chunk is still in flight", async ({
    page,
  }) => {
    await withFeaturesHeld(page, async () => {
      // .click() waits out hydration; a bare keypress after goto would race it.
      await page.locator(TERMINAL_TOGGLE).click();
      await expectOpaqueAndStays(page, TERMINAL);

      // The trap focuses the input on open, so an invisible dialog is one the
      // reader is actively typing into. Naming it here keeps the stakes in the
      // failure output rather than only in the comment above.
      await expect(page.getByRole("textbox")).toBeFocused();
    });
  });

  test.describe("mobile menu", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("the menu is readable while the feature chunk is still in flight", async ({
      page,
    }) => {
      await withFeaturesHeld(page, async () => {
        await page.getByText("[menu]").click();
        await expectOpaqueAndStays(page, MENU);

        // The links carry their own `initial` — a staggered `opacity: 0, x: -30`
        // — so the overlay being opaque does not settle whether there is
        // anything readable inside it.
        const link = page
          .getByRole("dialog", { name: MENU.name })
          .getByRole("link")
          .first();
        expect(
          await effectiveOpacity(link),
          "the overlay is opaque but its links are not — the per-link entrance is still ungated"
        ).toBe(1);
      });
    });
  });

  test("the terminal still animates open once the chunk has landed", async ({
    page,
  }) => {
    // Armed before the navigation: the chunk is requested during the first
    // load, so a wait registered after `goto` resolves has already missed it.
    const chunkLanded = page.waitForResponse(FEATURES_CHUNK);
    await page.goto("/");
    await chunkLanded;

    const overlay = page.getByRole(TERMINAL.role, { name: TERMINAL.name });
    await page.locator(TERMINAL_TOGGLE).click();

    // Both ends asserted: suppressing the entrance unconditionally would also
    // make the test above pass, and this is what tells the two apart.
    const sawTransparent = await overlay.evaluate(
      (el) =>
        new Promise<boolean>((resolve) => {
          const transparent = () => Number(getComputedStyle(el).opacity) < 1;
          let seen = transparent();
          const started = performance.now();
          const tick = () => {
            seen ||= transparent();
            if (seen || performance.now() - started > 400) return resolve(seen);
            requestAnimationFrame(tick);
          };
          tick();
        })
    );

    expect(
      sawTransparent,
      "the terminal never animated — the feature chunk loaded but the entrance is suppressed anyway"
    ).toBe(true);
    await expect.poll(() => effectiveOpacity(overlay), { timeout: 2000 }).toBe(1);
  });
});
