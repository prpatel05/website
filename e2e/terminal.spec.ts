import {
  test,
  expect,
  TERMINAL_TOGGLE,
  openTerminalByClick,
  proveReactIsLive,
  type Page,
  expectOverlayOpen,
  expectOverlayClosed,
  TERMINAL_DIALOG,
} from "./fixtures";

const TERMINAL_LOG = '[role="log"][aria-label="Terminal output"]';

/** The command line, by its placeholder — the same handle every spec here uses. */
const commandLine = (page: Page) => page.getByPlaceholder('type "help" to get started...');

const runCommand = async (page: Page, cmd: string) => {
  await commandLine(page).fill(cmd);
  await page.keyboard.press("Enter");
};

test.describe("Interactive terminal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("opens terminal via button click", async ({ page }) => {
    // Deliberately not `openTerminalByClick` — the click path is this test's
    // subject, and every other test in the file leans on it, so it stays
    // spelled out rather than delegating to the helper it underwrites.
    await page.locator(TERMINAL_TOGGLE).click();
    await expect(page.getByText("pratik.pa.tel — bash")).toBeVisible();
    await expect(page.getByText("Welcome to pratik.pa.tel v3.0.1")).toBeVisible();
  });

  test("opens terminal via Ctrl+K shortcut", async ({ page }) => {
    // The one test whose subject is the shortcut. `proveReactIsLive` first, so a
    // failure here means the binding is wrong rather than that the press beat
    // hydration — see the helper for the measurements.
    await proveReactIsLive(page);

    await page.keyboard.press("Control+k");
    await expect(page.getByText("pratik.pa.tel — bash")).toBeVisible();
  });

  test("closes terminal via Escape key", async ({ page }) => {
    await openTerminalByClick(page);
    await expect(page.getByText("pratik.pa.tel — bash")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByText("pratik.pa.tel — bash")).not.toBeVisible();
  });

  /**
   * These care only about what a command prints, not about how the terminal was
   * opened — so they open through the click handler, which cannot outrun
   * hydration. Opening with Ctrl+K here bought no coverage the shortcut test
   * above does not already give, and cost seven flaky tests per CI run.
   */
  test.describe("commands", () => {
    test.beforeEach(async ({ page }) => {
      await openTerminalByClick(page);
    });

    test("help command lists available commands", async ({ page }) => {
      await commandLine(page).fill("help");
      await page.keyboard.press("Enter");

      await expect(page.getByText("┌─ Available Commands")).toBeVisible();
      await expect(page.getByText("help         Show available commands")).toBeVisible();
    });

    test("whoami command shows profile info", async ({ page }) => {
      await commandLine(page).fill("whoami");
      await page.keyboard.press("Enter");

      await expect(page.getByText("CTO & Chief Architect · 3x Company Builder")).toBeVisible();
    });

    test("ls command shows site sections", async ({ page }) => {
      await commandLine(page).fill("ls");
      await page.keyboard.press("Enter");

      await expect(page.getByText("about/")).toBeVisible();
      await expect(page.getByText("blog/")).toBeVisible();
      await expect(page.getByText("contact/")).toBeVisible();
      await expect(page.getByText("-rw-r--r--  resume.pdf")).toBeVisible();
    });

    test("pwd command shows working directory", async ({ page }) => {
      await commandLine(page).fill("pwd");
      await page.keyboard.press("Enter");

      await expect(page.getByText("/home/pratik/portfolio")).toBeVisible();
    });

    test("echo command echoes message back", async ({ page }) => {
      await commandLine(page).fill("echo hello world");
      await page.keyboard.press("Enter");

      await expect(page.getByText("hello world", { exact: true })).toBeVisible();
    });

    test("unknown command shows error", async ({ page }) => {
      await commandLine(page).fill("fakecmd");
      await page.keyboard.press("Enter");

      await expect(page.getByText("command not found: fakecmd")).toBeVisible();
    });

    /**
     * The only command that routes, and so the only one that leaves a URL in
     * the address bar for the reader to copy or bookmark. It asked for the
     * unslashed `/blog`, which Pages 301s — the one place on the site emitting
     * the redirecting form everything else is careful to avoid. Asserted on the
     * landed URL rather than on the command table, so it covers the routing too:
     * the route is declared as `/blog`, and this is what proves the slashed
     * path still reaches it.
     */
    test("blog command navigates to the slash-terminated archive", async ({ page }) => {
      await commandLine(page).fill("blog");
      await page.keyboard.press("Enter");

      await page.waitForURL("**/blog/");
      expect(new URL(page.url()).pathname).toBe("/blog/");
      await expect(page.getByRole("heading", { name: "Blog archive" })).toBeVisible();
    });

    test("clear command clears terminal output", async ({ page }) => {
      await expect(page.getByText("Welcome to pratik.pa.tel v3.0.1")).toBeVisible();

      await commandLine(page).fill("clear");
      await page.keyboard.press("Enter");

      await expect(page.getByText("Welcome to pratik.pa.tel v3.0.1")).not.toBeVisible();
    });
  });
});

/**
 * The other half of PRA-744. Making the tests wait for hydration stops them
 * flaking, but it does that by no longer exercising the window a real visitor
 * can land in: every route is prerendered, so the page — including the button
 * advertising "Ctrl+K" — is painted and readable while the bundle is still
 * downloading. Press the shortcut there and, before the fix, nothing happened
 * and the browser took the keystroke for its own search bar.
 *
 * This holds the bundle outright rather than leaning on CPU throttling, so the
 * press is pre-hydration by construction instead of by luck — the same reason
 * the old flaky tests were not a usable regression test for this.
 */
test.describe("Ctrl+K before hydration", () => {
  test("opens the terminal once React arrives", async ({ page }) => {
    let release!: () => void;
    const bundleHeld = new Promise<void>((resolve) => {
      release = resolve;
    });

    await page.route("**/assets/**.js", async (route) => {
      await bundleHeld;
      await route.continue();
    });

    // `commit`, not the default `load`: the module script is deferred, so
    // waiting for load would wait for the very bundle being held.
    await page.goto("/", { waitUntil: "commit" });

    // The stand-in is bound and React has not claimed it yet. This is the
    // precondition the whole test rests on, so it is asserted, not assumed —
    // React's mount effect clears `__terminalBoot`, so its presence is direct
    // proof we are still pre-hydration.
    await page.waitForFunction(() => window.__terminalBoot !== undefined);
    await expect(page.locator(TERMINAL_TOGGLE)).toBeVisible();

    await page.keyboard.press("Control+k");

    // Still pre-hydration, and still nothing on screen: the stand-in only
    // records the intent, it does not render a terminal of its own.
    expect(await page.evaluate(() => window.__terminalBoot !== undefined)).toBe(true);
    await expect(page.getByText("pratik.pa.tel — bash")).not.toBeVisible();

    release();

    await expect(page.getByText("pratik.pa.tel — bash")).toBeVisible();
    // The strong gate, and this is the case that most needs it: the terminal
    // that opens out of a pre-hydration Ctrl+K is the one PRA-884 shipped at
    // `opacity: 0` with the focus trap putting the caret in it.
    await expectOverlayOpen(page, TERMINAL_DIALOG);
  });

  /**
   * `index.html` is the shell for every route, but only the home route mounts a
   * terminal. So the stand-in must not bind on the others: there is nothing
   * there to claim it, and an unclaimed stand-in keeps calling preventDefault
   * for the life of the page — permanently eating a shortcut that, before any of
   * this, at least still reached the browser.
   *
   * The home route runs the same probe as a positive control. Without it this
   * would pass just as happily against a stand-in that had been deleted
   * outright, or one whose toggle selector had rotted into matching nothing.
   */
  for (const { route, path, armed } of [
    { route: "a route with no terminal", path: "/blog/", armed: false },
    { route: "the home route", path: "/", armed: true },
  ]) {
    test(`Ctrl+K is ${armed ? "" : "not "}swallowed pre-hydration on ${route}`, async ({ page }) => {
      await page.route("**/assets/**.js", () => {
        /* never continued: holds the page pre-hydration for the whole test */
      });

      await page.goto(path, { waitUntil: "commit" });

      // `commit` resolves before the body is parsed, and the stand-in is the
      // last thing in it. Waiting on the toggle is not enough — it parses in
      // first, so probing then reads a page that has not run the script yet and
      // an unguarded build looks identical to a guarded one.
      await page.waitForFunction(() => window.__terminalBoot !== undefined);
      expect(await page.evaluate(() => window.__terminalBoot?.armed)).toBe(armed);
      await expect(page.locator(TERMINAL_TOGGLE)).toHaveCount(armed ? 1 : 0);

      // Registered after the stand-in, so it observes whether that handler
      // called preventDefault — the actual user-visible stake, not bookkeeping.
      await page.evaluate(() => {
        window.addEventListener("keydown", (e) => {
          (window as unknown as { __sawPrevented?: boolean }).__sawPrevented = e.defaultPrevented;
        });
      });

      await page.keyboard.press("Control+k");

      expect(
        await page.evaluate(
          () => (window as unknown as { __sawPrevented?: boolean }).__sawPrevented,
        ),
      ).toBe(armed);
    });
  }

  /**
   * The other way nothing ever claims the stand-in, and the one the route check
   * above cannot cover: the right route, but a bundle that never arrives. A
   * chunk 404'd by a deploy, a connection that drops mid-download — the toggle
   * is prerendered so the stand-in arms, and then no React ever mounts to
   * retire it. It swallowed Ctrl+K for the life of the page with nothing on the
   * other side to open, which is worse than the gap it exists to close.
   *
   * So it gives up on its own. The test spends the real ten seconds rather than
   * reaching in to shorten them: the timeout is the behaviour under test, and a
   * build that had lost it would look identical to one whose deadline this
   * test had quietly redefined.
   */
  test("hands Ctrl+K back to the browser when the bundle never arrives", async ({ page }) => {
    await page.route("**/assets/**.js", () => {
      /* never continued: nothing will ever mount to claim the stand-in */
    });

    await page.goto("/", { waitUntil: "commit" });

    // Registered after the stand-in — see the sibling above — and re-read
    // rather than replaced, so both presses are measured by the same probe.
    await page.waitForFunction(() => window.__terminalBoot !== undefined);
    await page.evaluate(() => {
      window.addEventListener("keydown", (e) => {
        (window as unknown as { __sawPrevented?: boolean }).__sawPrevented = e.defaultPrevented;
      });
    });
    const sawPrevented = () =>
      page.evaluate(() => (window as unknown as { __sawPrevented?: boolean }).__sawPrevented);

    // Positive control. Without it the assertion after the wait passes just as
    // well against a stand-in that never armed in the first place, which is the
    // one thing this must not be confused with.
    await page.keyboard.press("Control+k");
    expect(await sawPrevented(), "the stand-in never armed, so it had nothing to give up").toBe(
      true,
    );

    await page.waitForFunction(() => window.__terminalBoot?.armed === false, undefined, {
      timeout: 20_000,
    });

    await page.keyboard.press("Control+k");
    expect(
      await sawPrevented(),
      "Ctrl+K is still swallowed after the stand-in gave up on the bundle",
    ).toBe(false);
  });
});

/**
 * Four defects a reader hits by using the terminal the way it invites — parked
 * unverified out of the PRA-920 sweep, then each one driven in a browser before
 * it was fixed (PRA-921). The measurements from that pass are quoted in each
 * test, because every one of these is a green-looking component: nothing throws,
 * nothing is missing from the DOM, and the assertions that would have caught
 * them are the ones nobody thought to write.
 */
test.describe("terminal defects a reader can reach", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  /**
   * The autoscroll effect keyed on `[lines]` alone. Closing unmounts the
   * scroller, so reopening mounts a fresh one at `scrollTop = 0` — and `lines`
   * has not changed, so nothing scrolls it back down. Measured on `main`:
   * `scrollTop` 149 before Escape, 0 after reopening, with 231px of overflow
   * and the welcome banner sitting where the prompt should be.
   */
  test("reopening lands on the newest output, not the top of the scrollback", async ({ page }) => {
    const scroller = () =>
      page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        return {
          top: Math.round(el.scrollTop),
          overflow: Math.round(el.scrollHeight - el.clientHeight),
        };
      }, TERMINAL_LOG);

    await openTerminalByClick(page);
    await runCommand(page, "help");
    await runCommand(page, "whoami");

    // The precondition, asserted rather than assumed: if the output ever stops
    // overflowing, every scroll assertion below is trivially satisfiable and
    // this test would keep passing while covering nothing.
    await expect
      .poll(async () => (await scroller())?.overflow ?? 0, {
        message: "the scrollback never overflowed, so there is nothing to scroll",
      })
      .toBeGreaterThan(0);

    await page.keyboard.press("Escape");
    await expectOverlayClosed(page, TERMINAL_DIALOG);

    await page.locator(TERMINAL_TOGGLE).click();
    await expectOverlayOpen(page, TERMINAL_DIALOG);

    // Pinned to the bottom, not merely "not at the top" — the reader left at
    // the prompt and that is where they should come back to. 1px of slack for
    // subpixel layout; the defect is off by the full 231.
    await expect
      .poll(
        async () => {
          const s = await scroller();
          return s ? s.overflow - s.top : null;
        },
        { message: "the reopened terminal is not showing the newest output" },
      )
      .toBeLessThanOrEqual(1);
  });

  /**
   * `e.key` carries the character the key produces, so Caps Lock turns the k of
   * Ctrl+K into "K" and an `=== "k"` test stops matching — the shortcut the
   * toggle's tooltip and the `help` table both advertise was simply dead for a
   * reader typing in caps. Measured on `main`: 0 dialogs for the uppercase
   * event, 1 for the lowercase control.
   *
   * Dispatched through CDP rather than `page.keyboard`, which has no Caps Lock
   * state to emulate: pressing "CapsLock" through it leaves the next press
   * reporting `key: "k"` with `getModifierState("CapsLock") === false`, so it
   * cannot express this case at all. The recorded event is asserted first, so a
   * green result means the handler accepted an uppercase K rather than that the
   * dispatch never reached the page.
   */
  test("Ctrl+K opens the terminal with Caps Lock on", async ({ page }) => {
    await proveReactIsLive(page);

    await page.evaluate(() => {
      (window as unknown as { __keys?: unknown[] }).__keys = [];
      window.addEventListener(
        "keydown",
        (e) => (window as unknown as { __keys: unknown[] }).__keys.push({ key: e.key, ctrl: e.ctrlKey }),
        true,
      );
    });

    const cdp = await page.context().newCDPSession(page);
    for (const type of ["rawKeyDown", "keyUp"] as const) {
      await cdp.send("Input.dispatchKeyEvent", {
        type,
        modifiers: 2 /* Ctrl */,
        key: "K",
        code: "KeyK",
        windowsVirtualKeyCode: 75,
        nativeVirtualKeyCode: 75,
      });
    }

    expect(
      await page.evaluate(() => (window as unknown as { __keys: unknown[] }).__keys),
      "the uppercase Ctrl+K never reached the page, so nothing below is being tested",
    ).toEqual([{ key: "K", ctrl: true }]);

    await expectOverlayOpen(page, TERMINAL_DIALOG);
  });

  /**
   * `click` fires on the common ancestor of mousedown and mouseup, so a drag
   * that selects terminal output ends on the dialog's click-to-focus handler,
   * and focusing a text input collapses the document selection. Measured on
   * `main`: the line was selected mid-drag and `getSelection()` was empty by the
   * time the mouse came up, with focus on the command line — so the email
   * address `whoami` prints could not be copied at all.
   */
  test("drag-selecting terminal output keeps the selection", async ({ page }) => {
    await openTerminalByClick(page);
    await runCommand(page, "whoami");

    const line = page.getByText("CTO & Chief Architect · 3x Company Builder");
    await expect(line).toBeVisible();
    // The overlay animates in on a `y` offset; a box read mid-flight would put
    // the drag somewhere the text no longer is.
    await expectOverlayOpen(page, TERMINAL_DIALOG);
    const box = (await line.boundingBox())!;

    // `page.mouse` in viewport coordinates rather than a locator action:
    // `locator.click()` and `.focus()` both scroll the document, which would
    // move the target out from under the coordinates being dragged across.
    await page.mouse.move(box.x + 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 12 });

    // The precondition: the drag really did select something. Without this the
    // assertion after mouseup passes just as well against a gesture that never
    // selected anything in the first place.
    expect(
      await page.evaluate(() => window.getSelection()?.toString() ?? ""),
      "the drag selected nothing, so surviving the mouseup proves nothing",
    ).toContain("Chief Architect");

    await page.mouse.up();

    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString() ?? ""), {
        message: "the mouseup cleared the reader's selection",
      })
      .toContain("Chief Architect");

  });

  /**
   * The other side of the guard above: it must not cost the terminal its
   * click-to-focus, which is how the caret gets back to the command line after
   * a click lands anywhere else in the dialog. Without this, the drag test
   * passes just as well against a build with the focus call deleted outright.
   *
   * The one case the guard does change is a click landing *inside* an existing
   * selection: Chromium holds that selection through mousedown so the text can
   * be dragged, and only collapses it after the click dispatches, so the guard
   * sees a live selection and declines. The caret comes back on the next click.
   * That is the deliberate trade — a second click, against output that could not
   * be copied at all.
   */
  test("clicking the terminal puts the caret back on the command line", async ({ page }) => {
    await openTerminalByClick(page);
    await expect(commandLine(page)).toBeFocused();

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(commandLine(page)).not.toBeFocused();

    // The blank right edge of the output, so the click carries no selection of
    // its own — the terminal's lines are far shorter than the pane is wide.
    const log = (await page.locator(TERMINAL_LOG).boundingBox())!;
    await page.mouse.click(log.x + log.width - 4, log.y + 6);

    await expect(commandLine(page)).toBeFocused();
  });

  /**
   * A deferred navigate/scroll waits out the 300ms exit animation, so the
   * terminal is on screen for the whole window and reopening inside it is
   * something a reader does rather than a race. Measured on `main`: `contact`
   * then a reopen scrolled the page 3062px underneath the reopened overlay, and
   * `blog` routed away and took the terminal with it, since only the home route
   * mounts one.
   *
   * Reopened with a keypress, not the toggle: React is provably live by this
   * point (the terminal was opened by click), and a press is a single round
   * trip where a click's actionability pipeline is several — the reopen has to
   * land inside 300ms for the test to be exercising the cancel at all.
   */
  for (const { command, effect, settle } of [
    {
      command: "blog",
      effect: "route away",
      settle: async (page: Page) => {
        await page.waitForTimeout(1000);
        expect(new URL(page.url()).pathname).toBe("/");
      },
    },
    {
      command: "contact",
      effect: "scroll the page",
      settle: async (page: Page) => {
        await page.waitForTimeout(1500);
        expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);
      },
    },
  ]) {
    test(`reopening cancels a pending ${command}, which would otherwise ${effect} under the reader`, async ({
      page,
    }) => {
      await openTerminalByClick(page);
      expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);

      await runCommand(page, command);
      await page.keyboard.press("Control+k");

      // The terminal is back before the deferred action was due. If this fails
      // the reopen missed its window and the test below would be measuring the
      // harness, so it is asserted separately and says so.
      await expectOverlayOpen(page, TERMINAL_DIALOG);

      await settle(page);
      // Still open: whatever was pending neither fired nor took the overlay
      // with it.
      await expectOverlayOpen(page, TERMINAL_DIALOG);
    });
  }

  /**
   * The positive control for the pair above, and the only thing that keeps them
   * honest: a build where `defer` never fired at all would pass both. The
   * `blog` half is already covered by the navigation test further up, so this
   * is the scroll half.
   */
  test("a command that scrolls still scrolls when the terminal is left closed", async ({ page }) => {
    await openTerminalByClick(page);
    await runCommand(page, "contact");

    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(0);
  });
});
