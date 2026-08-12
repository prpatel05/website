import {
  test,
  expect,
  TERMINAL_TOGGLE as openTerminal,
  openTerminalByClick,
  proveReactIsLive,
  type Page,
} from "./fixtures";

/**
 * Where the keyboard actually is, relative to the open dialog.
 *
 * `toBeFocused()` can only ask "is focus on this control I already expect it to
 * be on"; the defect these guard is focus landing somewhere nobody named — on
 * `<body>`, or on a link painted over by the overlay and dropped from the
 * accessibility tree by `aria-modal`. So read `document.activeElement` directly
 * and carry its identity into the failure message.
 */
const focusLocation = (page: Page, dialogName: string) =>
  page.evaluate((name) => {
    const dialog = document.querySelector(`[role="dialog"][aria-label="${name}"]`);
    const active = document.activeElement;
    return {
      inside: !!dialog && !!active && dialog.contains(active),
      active: active
        ? `${active.tagName}|${(
            active.getAttribute("aria-label") ??
            active.textContent ??
            ""
          ).trim().slice(0, 40)}`
        : "none",
    };
  }, dialogName);

/**
 * Tab `presses` times, asserting containment after every one. Two full laps of
 * the dialog: stopping one press short of the last control leaves a completely
 * absent trap looking contained.
 */
async function expectTabStaysInside(page: Page, dialogName: string, presses: number) {
  for (let i = 1; i <= presses; i++) {
    await page.keyboard.press("Tab");
    const { inside, active } = await focusLocation(page, dialogName);
    expect(inside, `after ${i} Tab press(es) focus was on ${active}`).toBe(true);
  }
}

test.describe("Mobile menu accessibility", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByText("[menu]").click();
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();
  });

  test("overlay is exposed as a labelled modal dialog", async ({ page }) => {
    const dialog = page.getByRole("dialog", { name: "Site menu" });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  test("close button is reachable by its accessible name", async ({ page }) => {
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(page.getByRole("dialog", { name: "Site menu" })).not.toBeVisible();
  });

  test("Escape dismisses the menu", async ({ page }) => {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Site menu" })).not.toBeVisible();
  });

  test("clicking the backdrop dismisses the menu", async ({ page }) => {
    // Bottom-left corner: clear of the centred link stack and of the close
    // button in the top-right, so the click lands on the overlay itself.
    await page.mouse.click(10, 640);
    await expect(page.getByRole("dialog", { name: "Site menu" })).not.toBeVisible();
  });

  test("clicking a link does not leave the menu open", async ({ page }) => {
    // Guards the e.target === e.currentTarget check: a bubbled click from a
    // child must not be mistaken for a backdrop click, and the link's own
    // handler must still close the menu.
    await page.getByRole("link", { name: "about()" }).click();
    await expect(page.getByRole("dialog", { name: "Site menu" })).not.toBeVisible();
  });

  test("opening moves focus into the dialog", async ({ page }) => {
    // `aria-modal="true"` drops the rest of the page — including the [menu]
    // button focus was sitting on — out of the accessibility tree. Leaving
    // focus there parks a screen-reader user on a node the AT can no longer
    // see, and the dialog's own name and contents are never announced.
    await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();
    expect(await focusLocation(page, "Site menu")).toMatchObject({ inside: true });
  });

  test("Tab stays inside the dialog", async ({ page }) => {
    // Close button plus four links; 12 presses is two and a bit laps.
    await expectTabStaysInside(page, "Site menu", 12);
  });

  test("Shift+Tab stays inside the dialog", async ({ page }) => {
    for (let i = 1; i <= 12; i++) {
      await page.keyboard.press("Shift+Tab");
      const { inside, active } = await focusLocation(page, "Site menu");
      expect(inside, `after ${i} Shift+Tab press(es) focus was on ${active}`).toBe(true);
    }
  });

  test("focus wraps at both boundaries", async ({ page }) => {
    await page.getByRole("link", { name: "resume()" }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("link", { name: "resume()" })).toBeFocused();
  });

  test("closing returns focus to the button that opened the menu", async ({ page }) => {
    // Move focus off the toggle and into the dialog first. Asserting straight
    // after open would pass against a build with no focus handling at all,
    // because there focus never leaves the toggle to begin with.
    await page.getByRole("link", { name: "writing()" }).focus();

    await page.keyboard.press("Escape");
    await expect(page.getByText("[menu]")).toBeFocused();
  });

  test("menu button reports its expanded state", async ({ page }) => {
    await expect(page.getByText("[menu]")).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(page.getByText("[menu]")).toHaveAttribute("aria-expanded", "false");
  });
});

/**
 * The two ways the menu's focus restore ends in nothing being focused. Both need
 * their own `goto`, so they sit outside the describe above rather than fighting
 * its beforeEach.
 *
 * "Nothing focused" is never neutral: the dialog node the keyboard was on is
 * being removed, and removing a focused node does not move Chrome's sequential
 * focus starting point — it stays in the hole, and the reader's next Tab resumes
 * from the middle of the document. So each of these asserts on a named
 * destination, not on `activeElement !== null`.
 */
test.describe("Mobile menu focus restore", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("closing returns focus to [menu] even when opening never focused it", async ({
    page,
  }) => {
    await page.goto("/");
    await proveReactIsLive(page);

    // Safari and Firefox do not focus a `<button>` on click, so there the menu
    // opens from `<body>` on every single tap and the trap has nothing to
    // remember. `HTMLElement.click()` is that exact state in Chromium — it runs
    // the handler and moves focus nowhere — which is the only way to reach the
    // case at all with chromium and mobile-chrome as the only projects.
    // `proveReactIsLive` leaves focus on the terminal toggle, so clear it: the
    // precondition below is the whole test, and a focused toggle would make the
    // restore succeed for the wrong reason.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.tagName))
      .toBe("BODY");

    await page.evaluate(() => {
      const toggle = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("[menu]")
      );
      if (!toggle) throw new Error("[menu] button not found");
      toggle.click();
    });
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();
    // Focus moved into the dialog and not onto the toggle, so the node the trap
    // remembered really was `<body>`.
    await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page.getByText("[menu]")).toBeFocused();
  });

  test("crossing the breakpoint closes the menu and puts the tab order back", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByText("[menu]").click();
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();
    // Off the toggle and into the dialog, so the restore has somewhere to come
    // back from — asserting straight after open would pass with no handling.
    await page.getByRole("link", { name: "writing()" }).focus();

    await page.setViewportSize({ width: 1024, height: 667 });

    // A CSS locator, not `getByRole`, and not interchangeable here. `getByRole`
    // reads the accessibility tree, which `md:hidden` empties the instant the
    // viewport crosses — so the role version reaches 0 without the menu ever
    // closing. It would pass against a build with no breakpoint handling at all,
    // and it also lets the Tab below race the close it is supposed to be waiting
    // on (which is how this test failed ~50% of the time under two-worker
    // contention while passing alone). Counting DOM nodes waits for the real
    // unmount.
    await expect(page.locator('[role="dialog"][aria-label="Site menu"]')).toHaveCount(0);
    // `[menu]` is `md:hidden` at this width: in the document, `display:none`,
    // and `.focus()` on it a silent no-op. So there is deliberately nothing to
    // restore to here, and the only thing left to get right is not stranding
    // the tab order on the dialog that just went away. First Tab lands where a
    // fresh load's would.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  });
});

test.describe("Terminal accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await openTerminalByClick(page);
  });

  test("command input has an accessible name, not just a placeholder", async ({ page }) => {
    await expect(page.getByRole("textbox", { name: "Terminal command" })).toBeFocused();
  });

  test("output is a labelled live region so results are announced", async ({ page }) => {
    const log = page.getByRole("log", { name: "Terminal output" });
    await expect(log).toHaveAttribute("aria-live", "polite");
  });

  test("exactly one close control is exposed to assistive tech", async ({ page }) => {
    // The macOS-style red dot is a redundant mouse-only affordance; exposing it
    // too would announce two identically named buttons.
    await expect(page.getByRole("button", { name: "Close terminal" })).toHaveCount(1);
  });

  test("close button is reachable by its accessible name", async ({ page }) => {
    await page.getByRole("button", { name: "Close terminal" }).click();
    await expect(page.getByRole("dialog", { name: "Interactive terminal" })).not.toBeVisible();
  });

  test("Tab stays inside the dialog", async ({ page }) => {
    // Only two stops here — the close button and the command input — so the
    // untrapped escape shows up on the second press.
    await expectTabStaysInside(page, "Interactive terminal", 8);
  });

  test("Shift+Tab stays inside the dialog", async ({ page }) => {
    for (let i = 1; i <= 8; i++) {
      await page.keyboard.press("Shift+Tab");
      const { inside, active } = await focusLocation(page, "Interactive terminal");
      expect(inside, `after ${i} Shift+Tab press(es) focus was on ${active}`).toBe(true);
    }
  });

  test("closing returns focus to the toggle button", async ({ page }) => {
    // The toggle unmounts while the terminal is open, so the node focus came
    // from is detached by restore time and the trap has to fall back to the
    // freshly mounted button.
    await page.keyboard.press("Escape");
    await expect(page.locator(openTerminal)).toBeFocused();
  });
});

// `proveReactIsLive` lives in ./fixtures now, shared with terminal.spec.ts —
// see there for why a click gates on hydration and a keypress does not.
test.describe("Terminal opened by keyboard", () => {
  test("Escape returns focus to wherever Ctrl+K was pressed", async ({ page }) => {
    await page.goto("/");
    await proveReactIsLive(page);

    const invoker = page.getByRole("link", { name: "pratik.pa.tel" });
    await invoker.focus();

    await page.keyboard.press("Control+k");
    await expect(page.getByRole("textbox", { name: "Terminal command" })).toBeFocused();

    await page.keyboard.press("Escape");
    // Still in the document, so it wins over the toggle-button fallback.
    await expect(invoker).toBeFocused();
  });

  test("Escape lands somewhere real when Ctrl+K was pressed with nothing focused", async ({
    page,
  }) => {
    await page.goto("/");
    await proveReactIsLive(page);

    // The state under test: document.activeElement is <body>, which the trap
    // has to reject rather than restore to, or closing drops the keyboard at
    // the top of the document with nothing selected. Escape above left focus
    // on the toggle button, so clear it explicitly.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.tagName))
      .toBe("BODY");

    await page.keyboard.press("Control+k");
    await expect(page.getByRole("textbox", { name: "Terminal command" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page.locator(openTerminal)).toBeFocused();
  });
});
