import {
  test,
  expect,
  TERMINAL_TOGGLE,
  openTerminalByClick,
  proveReactIsLive,
  type Page,
} from "./fixtures";

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

    const command = (page: Page) => page.getByPlaceholder('type "help" to get started...');

    test("help command lists available commands", async ({ page }) => {
      await command(page).fill("help");
      await page.keyboard.press("Enter");

      await expect(page.getByText("┌─ Available Commands")).toBeVisible();
      await expect(page.getByText("help         Show available commands")).toBeVisible();
    });

    test("whoami command shows profile info", async ({ page }) => {
      await command(page).fill("whoami");
      await page.keyboard.press("Enter");

      await expect(page.getByText("CTO & Chief Architect · 3x Company Builder")).toBeVisible();
    });

    test("ls command shows site sections", async ({ page }) => {
      await command(page).fill("ls");
      await page.keyboard.press("Enter");

      await expect(page.getByText("about/")).toBeVisible();
      await expect(page.getByText("blog/")).toBeVisible();
      await expect(page.getByText("contact/")).toBeVisible();
      await expect(page.getByText("-rw-r--r--  resume.pdf")).toBeVisible();
    });

    test("pwd command shows working directory", async ({ page }) => {
      await command(page).fill("pwd");
      await page.keyboard.press("Enter");

      await expect(page.getByText("/home/pratik/portfolio")).toBeVisible();
    });

    test("echo command echoes message back", async ({ page }) => {
      await command(page).fill("echo hello world");
      await page.keyboard.press("Enter");

      await expect(page.getByText("hello world", { exact: true })).toBeVisible();
    });

    test("unknown command shows error", async ({ page }) => {
      await command(page).fill("fakecmd");
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
      await command(page).fill("blog");
      await page.keyboard.press("Enter");

      await page.waitForURL("**/blog/");
      expect(new URL(page.url()).pathname).toBe("/blog/");
      await expect(page.getByRole("heading", { name: "Blog archive" })).toBeVisible();
    });

    test("clear command clears terminal output", async ({ page }) => {
      await expect(page.getByText("Welcome to pratik.pa.tel v3.0.1")).toBeVisible();

      await command(page).fill("clear");
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
    await expect(page.getByRole("dialog", { name: "Interactive terminal" })).toBeVisible();
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
});
