import {
  test,
  expect,
  TERMINAL_TOGGLE,
  openMobileMenu,
  expectOverlayClosed,
  expectOverlayOpen,
  dialogSelector,
  SITE_MENU,
  TERMINAL_DIALOG,
  type Page,
} from "./fixtures";

/**
 * Ctrl+K works while the mobile menu is open, so the site has a two-overlay
 * state — `useScrollLock` has been refcounted for it since PRA-886. Every other
 * overlay spec exercises one overlay at a time and none of them can see what
 * the pair does to the keyboard, which is how PRA-912 shipped: one Escape
 * closed *both*, and the terminal's trap then handed focus to a button inside
 * the menu overlay that was 300ms into its own exit. When that node went, it
 * took the sequential focus navigation starting point with it and the next Tab
 * resumed from the middle of the document — past the skip link, the wordmark
 * and `[menu]`, the whole of the site navigation.
 *
 * So the invariant these guard is not "Escape closes things". It is that one
 * Escape dismisses exactly one overlay, and that focus is never handed to a
 * node that is on its way out of the document.
 */

/** Where the keyboard is, and whether it is somewhere that will still exist. */
const focusReport = (page: Page) =>
  page.evaluate(
    ([menuSel, terminalSel]) => {
      const active = document.activeElement as HTMLElement | null;
      const menu = document.querySelector(menuSel);
      return {
        active: active
          ? `${active.tagName}|${(
              active.getAttribute("aria-label") ??
              active.textContent ??
              ""
            )
              .trim()
              .slice(0, 40)}`
          : "none",
        connected: !!active?.isConnected,
        insideMenu: !!menu && !!active && menu.contains(active),
        menuOpen: !!menu,
        terminalOpen: !!document.querySelector(terminalSel),
        // Two `aria-modal` dialogs at once is two dialogs the reader is told
        // are the only thing on the page.
        exposedModals: document.querySelectorAll(
          '[role="dialog"][aria-modal="true"]:not([inert]):not([inert] *)'
        ).length,
      };
    },
    [dialogSelector(SITE_MENU), dialogSelector(TERMINAL_DIALOG)] as const
  );

/**
 * Opens the menu, then the terminal on top of it, by the two routes a visitor
 * actually has. The click gates on hydration (see `fixtures.ts`); by the time
 * it returns, the Ctrl+K binding is live.
 */
async function openBothOverlays(page: Page) {
  await page.goto("/");
  await openMobileMenu(page);
  await page.keyboard.press("Control+k");
  await expectOverlayOpen(page, TERMINAL_DIALOG);
  await expect(page.getByRole("textbox", { name: "Terminal command" })).toBeFocused();
}

test.describe("Terminal stacked over the mobile menu", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("one Escape dismisses only the terminal", async ({ page }) => {
    await openBothOverlays(page);

    await page.keyboard.press("Escape");

    await expectOverlayClosed(page, TERMINAL_DIALOG);
    // The menu was not what the reader dismissed. Closing it too is both a
    // surprise and the thing that strands the keyboard below.
    await expect(page.locator(dialogSelector(SITE_MENU))).toHaveCount(1);
    await expectOverlayOpen(page, SITE_MENU);
  });

  test("a second Escape dismisses the menu and returns focus to [menu]", async ({ page }) => {
    await openBothOverlays(page);

    await page.keyboard.press("Escape");
    await expectOverlayClosed(page, TERMINAL_DIALOG);
    await page.keyboard.press("Escape");

    await expectOverlayClosed(page, SITE_MENU);
    await expect(page.getByText("[menu]")).toBeFocused();
  });

  test("closing the terminal never parks focus on a node that is leaving", async ({
    page,
  }) => {
    await openBothOverlays(page);
    await page.keyboard.press("Escape");

    // The measured failure: focus sat on the menu's "Close menu" button —
    // connected, with client rects, and 300ms from being removed — for the
    // whole of the exit, then went to BODY. Sample across that window rather
    // than after it, because a single late reading cannot tell "handed to a
    // dying node" apart from "handed nowhere in the first place".
    const samples: Array<Awaited<ReturnType<typeof focusReport>>> = [];
    for (let i = 0; i < 6; i++) {
      samples.push(await focusReport(page));
      await page.waitForTimeout(60);
    }

    for (const [i, s] of samples.entries()) {
      expect(
        s,
        `sample ${i} (${i * 60}ms after Escape) had focus on ${s.active}`
      ).toMatchObject({ connected: true, menuOpen: true });
      expect(s.active, `sample ${i} dropped the keyboard on <body>`).not.toBe("BODY|");
    }
  });

  test("the next Tab is still inside the menu, not loose in the document", async ({
    page,
  }) => {
    await openBothOverlays(page);
    await page.keyboard.press("Escape");
    await expectOverlayClosed(page, TERMINAL_DIALOG);

    // The user-visible half of PRA-912. On the broken build these three presses
    // walked the hero's terminal-style links — `./contact --init`,
    // `cat resume.pdf`, `ls ./posts` — because the removed node left the
    // sequential focus starting point mid-document, and the skip link, the
    // wordmark and `[menu]` were all behind it and unreachable by forward Tab.
    for (let i = 1; i <= 3; i++) {
      await page.keyboard.press("Tab");
      const report = await focusReport(page);
      expect(report, `after ${i} Tab press(es) focus was on ${report.active}`).toMatchObject(
        { insideMenu: true }
      );
    }
  });

  test("only the top overlay is exposed as a modal dialog", async ({ page }) => {
    await openBothOverlays(page);

    // Two simultaneous `aria-modal="true"` dialogs tells a screen reader that
    // each of them is the only thing on the page. The covered one is also
    // painted and unreachable, so it is `inert`: out of the accessibility tree
    // and out of the tab order until it is on top again.
    expect(await focusReport(page)).toMatchObject({ exposedModals: 1 });
    await expect(page.locator(dialogSelector(SITE_MENU))).toHaveAttribute("inert", "");

    await page.keyboard.press("Escape");
    await expectOverlayClosed(page, TERMINAL_DIALOG);

    // ...and back, or the menu is left permanently unusable underneath a
    // terminal that has gone.
    await expect(page.locator(dialogSelector(SITE_MENU))).not.toHaveAttribute("inert", "");
    expect(await focusReport(page)).toMatchObject({ exposedModals: 1 });
  });

  test("Tab is trapped by the terminal, not tugged back by the menu", async ({ page }) => {
    await openBothOverlays(page);

    // Both traps bind a capture-phase keydown on `document`, so without an
    // explicit top-of-stack check the covered menu's trap also answers every
    // Tab — it sees focus outside its own container and pulls it back to
    // "Close menu", inside a dialog the reader cannot see.
    const visited = new Set<string>();
    for (let i = 1; i <= 6; i++) {
      await page.keyboard.press("Tab");
      const report = await focusReport(page);
      expect(report, `after ${i} Tab press(es) focus was on ${report.active}`).toMatchObject(
        { insideMenu: false, terminalOpen: true }
      );
      visited.add(report.active);
    }
    // Contained is only half a trap; the reader still has to be able to reach
    // the close button and the command line. See `overlay-a11y.spec.ts`.
    expect(visited.size, `6 Tabs never moved off ${[...visited].join(", ")}`).toBeGreaterThan(
      1
    );
  });

  test("Escape on the terminal alone still closes it", async ({ page }) => {
    // Negative control for the stack: with nothing underneath, the terminal's
    // Escape has to behave exactly as it always did. A "close only the top"
    // rule that closed nothing would pass every assertion above.
    await page.goto("/");
    await page.locator(TERMINAL_TOGGLE).click();
    await expectOverlayOpen(page, TERMINAL_DIALOG);

    await page.keyboard.press("Escape");
    await expectOverlayClosed(page, TERMINAL_DIALOG);
    await expect(page.locator(TERMINAL_TOGGLE)).toBeFocused();
  });
});
