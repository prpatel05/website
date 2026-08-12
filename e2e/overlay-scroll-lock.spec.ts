import { test, expect, proveReactIsLive, type Page } from "./fixtures";

/**
 * Both overlays are `fixed inset-0` over a document that used to stay perfectly
 * scrollable underneath. A swipe over the backdrop scrolled the page behind it —
 * the overlay does not move, which reads as frozen UI — and the reading position
 * the visitor came from was gone by the time they closed it.
 *
 * **A Playwright `.click()` cannot be used to open an overlay in this file.** Its
 * scroll-into-view step moves the document even for a `fixed` target: measured on
 * this page, clicking `[menu]` took a scroll of 500 to 0, and clicking the
 * terminal toggle took 400 to 3112. Every "the page did not move" assertion here
 * would be measuring Playwright. So the menu opens through a programmatic
 * `HTMLElement.click()` and the terminal through Ctrl+K, both of which leave the
 * scroll position alone (verified: 500 before, 500 after).
 */
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));

/** Opens the menu without Playwright's scroll-into-view. Assumes React is live. */
async function openMenu(page: Page) {
  await page.evaluate(() => {
    const toggle = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("[menu]")
    );
    if (!toggle) throw new Error("[menu] button not found");
    toggle.click();
  });
  await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();
}

/** Same, for any control already on screen. */
const clickInPage = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) throw new Error(`${sel} not found`);
    el.click();
  }, selector);

async function settleAt(page: Page, y: number) {
  await page.evaluate((target) => window.scrollTo(0, target), y);
  await expect.poll(() => scrollY(page)).toBe(y);
}

test.describe("Mobile menu holds the page still", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("a swipe over the overlay does not scroll the page behind it", async ({ page }) => {
    await page.goto("/");
    await settleAt(page, 500);

    await openMenu(page);
    // Opening is half the promise: the focus the trap moves into the dialog must
    // not drag the document either.
    expect(await scrollY(page)).toBe(500);

    await page.mouse.wheel(0, 800);
    // Nothing to wait *for* — the assertion is that a value does not change — so
    // give the scroll the frames it would need to happen before reading it.
    await page.waitForTimeout(200);
    expect(await scrollY(page)).toBe(500);

    await page.keyboard.press("Escape");
    await expect(page.locator('[role="dialog"][aria-label="Site menu"]')).toHaveCount(0);
    expect(await scrollY(page)).toBe(500);

    // Released, not merely overridden: the page has to be scrollable again, and
    // the inline styles the lock wrote have to be gone rather than left at
    // "hidden" for the next component to trip over.
    await page.mouse.wheel(0, 300);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(500);
    expect(
      await page.evaluate(() => ({
        overflow: document.body.style.overflow,
        overscroll: document.body.style.overscrollBehavior,
      }))
    ).toEqual({ overflow: "", overscroll: "" });
  });

  test("closing one overlay does not unlock the page under the other", async ({ page }) => {
    // The refcount. Ctrl+K works while the menu is open, so both dialogs can be
    // up at once; a lock/unlock pair per component would have the first close
    // hand the page back from under the second.
    await page.goto("/");
    await settleAt(page, 500);
    await openMenu(page);

    await page.keyboard.press("Control+k");
    await expect(page.getByRole("textbox", { name: "Terminal command" })).toBeFocused();

    await clickInPage(page, '[aria-label="Close terminal"]');
    await expect(page.locator('[role="dialog"][aria-label="Interactive terminal"]')).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();

    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(200);
    expect(await scrollY(page)).toBe(500);

    // And the count does come back down — otherwise this test would pass against
    // a lock that never releases at all.
    await page.keyboard.press("Escape");
    await expect(page.locator('[role="dialog"][aria-label="Site menu"]')).toHaveCount(0);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(500);
  });

  test("every link is reachable in a viewport too short to centre them", async ({ page }) => {
    // Four `text-4xl` links at `gap-6` clear a short landscape viewport, or a
    // normal one at a large OS text size. Flex centring put the overflow out of
    // reach in both directions; `m-auto` collapses instead of going negative.
    await page.setViewportSize({ width: 375, height: 200 });
    await page.goto("/");
    await openMenu(page);

    const onScreen = (name: string) =>
      page
        .getByRole("link", { name })
        .evaluate((el) => {
          const r = el.getBoundingClientRect();
          return r.top >= 0 && r.bottom <= window.innerHeight;
        });

    for (const name of ["resume()", "about()"]) {
      await page.getByRole("link", { name }).scrollIntoViewIfNeeded();
      expect(await onScreen(name), `${name} could not be scrolled into view`).toBe(true);
    }

    // The way out has to survive the scrolling too — `absolute` would have taken
    // the close button off with the content.
    await expect(page.getByRole("button", { name: "Close menu" })).toBeInViewport();
  });

  test("a tap on [menu] during the close fade reaches [menu]", async ({ page }) => {
    // There is only a fade to tap through once framer's feature chunk is here —
    // without it `AnimatePresence` unmounts the overlay on the spot, and the
    // sample below lands on an already-empty page (measured: `opacity` -1, i.e.
    // no overlay at all, in ~half the runs). Wait for the chunk so the 300ms
    // window actually exists; the opacity assertion further down is what proves
    // this worked rather than assuming it.
    const features = page.waitForResponse((response) =>
      /\/assets\/motion-features-[^/]*\.js$/.test(new URL(response.url()).pathname)
    );
    await page.goto("/");
    await features;
    // The nav is fixed, so this box is still where the button is later.
    const box = await page.getByText("[menu]").boundingBox();
    if (!box) throw new Error("[menu] has no box");
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    await openMenu(page);

    // Close, wait exactly one frame, then read what a tap at that point would
    // hit. The frame is not slack, it is the mechanism: React commits the
    // wrapper's class after the event, so a synchronous read finds the old
    // `pointer-events` and fails against the fix. A `setTimeout` instead made the
    // sample depend on how far the exit had got, which differs per project.
    //
    // Reading the browser's own hit testing rather than asserting "the menu
    // reopens": `[menu]` and the close button sit at the same coordinates, so a
    // tap that hits the wrong one is a no-op either way, and that version of this
    // test passed against a full revert of this branch.
    const onClose = await page.evaluate(async ({ x, y }) => {
      document.querySelector<HTMLElement>('[aria-label="Close menu"]')!.click();
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

      const overlay = document.querySelector('[role="dialog"][aria-label="Site menu"]');
      const hit = document.elementFromPoint(x, y);
      return {
        mounted: !!overlay,
        opacity: overlay ? Number(getComputedStyle(overlay).opacity) : -1,
        hit: hit ? `${hit.tagName}|${(hit.textContent ?? "").trim().slice(0, 20)}` : "none",
      };
    }, point);

    // The precondition, and the shape of the defect in one line: the layer is
    // already invisible (~0.06 one frame in) but still in the document, and it
    // stays there well past 350ms. Without this the assertion below would be free
    // on an already-unmounted page.
    expect(onClose.mounted, "the overlay had already unmounted at tap time").toBe(true);
    expect(onClose.hit, "the closing overlay was still eating the tap").toBe("BUTTON|[menu]");

    // And end to end with a raw mouse click, because `locator.click()` would wait
    // the fade out and then pass regardless.
    await page.mouse.click(point.x, point.y);
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();
  });
});

test.describe("Terminal holds the page still", () => {
  test("the page does not scroll under the terminal overlay", async ({ page }) => {
    await page.goto("/");
    // Opens and closes the terminal with a click, so do this before scrolling —
    // see the note at the top about what a Playwright click does to the scroll
    // position.
    await proveReactIsLive(page);
    await settleAt(page, 400);

    await page.keyboard.press("Control+k");
    await expect(page.getByRole("textbox", { name: "Terminal command" })).toBeFocused();
    expect(await scrollY(page)).toBe(400);

    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(200);
    expect(await scrollY(page)).toBe(400);

    await page.keyboard.press("Escape");
    await expect(page.locator('[role="dialog"][aria-label="Interactive terminal"]')).toHaveCount(0);
    expect(await scrollY(page)).toBe(400);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(400);
  });
});
