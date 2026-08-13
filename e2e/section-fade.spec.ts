import { test, expect, type Page } from "./fixtures";

/**
 * `useScrollAnimation` fades the homepage sections in against the scrollbar.
 * The hook's unit tests cover *whether* the fade is bound — it is dropped on
 * the entry the document loaded with, and under `prefers-reduced-motion`, both
 * so the prerendered page never ships invisible. `prerender-visibility.spec.ts`
 * covers that no-JavaScript case from the other side.
 *
 * Neither covers the case where the fade is actually live: a reader who arrives
 * at "/" through a client-side navigation. There the section opacity is driven
 * by `scrollYProgress`, and the failure that matters is a section that is still
 * dim once the reader has scrolled to it — the fade running too slowly, or, for
 * `#contact`, never finishing at all, because it is the last section on the
 * page and the document simply runs out of scroll before its range completes.
 *
 * So: opacity is only allowed to be partial while a section is still arriving.
 * Once it fills the viewport it must be fully painted.
 */

const SECTIONS = ["#about", "#writing", "#contact"] as const;

/** A section fills enough of the viewport that the reader is reading it. */
const READING_COVERAGE = 0.5;

type Reading = {
  opacity: number;
  coverage: number;
  inlineOpacity: string;
};

async function sampleSections(page: Page): Promise<Record<string, Reading>> {
  return page.evaluate((sections) => {
    const out: Record<string, Reading> = {};
    for (const sel of sections) {
      const section = document.querySelector(sel);
      // The opacity lives on the animated `.container` child, not the
      // <section> that carries the id and the ref.
      const box = section?.querySelector(":scope > .container") as
        | HTMLElement
        | undefined;
      if (!section || !box) continue;
      const r = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const covered = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      out[sel] = {
        opacity: Number(getComputedStyle(box).opacity),
        coverage: covered / vh,
        inlineOpacity: box.style.opacity,
      };
    }
    return out;
  }, SECTIONS as unknown as string[]);
}

async function scrollTo(page: Page, y: number) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  // framer-motion writes the style from a rAF after the scroll event, so a
  // sample taken in the same tick reads the previous frame's opacity.
  await page.evaluate(
    () =>
      new Promise<void>((res) =>
        requestAnimationFrame(() => requestAnimationFrame(() => res())),
      ),
  );
}

/**
 * Arrive at "/" the way a reader does when the fade is live — a client-side
 * navigation, not the entry the document loaded with.
 */
async function navigateToHome(page: Page) {
  await page.goto("/blog/");
  const home = page.getByRole("link", { name: "cd ~" });
  await expect(home).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { __sameDocument: boolean }).__sameDocument = true;
  });
  await home.click();
  await page.waitForURL((u) => new URL(u).pathname === "/");
  await expect(page.locator("#contact")).toHaveCount(1);

  // A full reload here would put us back on the loaded entry, where the fade is
  // deliberately off and every assertion below would pass without testing it.
  const sameDocument = await page.evaluate(
    () => (window as unknown as { __sameDocument?: boolean }).__sameDocument === true,
  );
  expect(
    sameDocument,
    "expected a client-side navigation — a full reload turns the fade off and makes this test vacuous",
  ).toBe(true);
}

test.describe("scroll fade after a client-side navigation", () => {
  test("a section is fully painted by the time the reader reaches it", async ({
    page,
  }) => {
    await navigateToHome(page);

    const scrollMax = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    expect(scrollMax, "homepage should be scrollable").toBeGreaterThan(500);

    const dimWhileRead: string[] = [];
    const seenReading = new Set<string>();
    const seenFading = new Set<string>();

    for (let y = 0; y <= scrollMax; y += 150) {
      await scrollTo(page, y);
      const reading = await sampleSections(page);
      for (const sel of SECTIONS) {
        const d = reading[sel];
        if (!d) continue;
        if (d.opacity < 0.99) seenFading.add(sel);
        if (d.coverage < READING_COVERAGE) continue;
        seenReading.add(sel);
        if (d.opacity < 0.99) {
          dimWhileRead.push(
            `${sel} at scrollY=${y}: opacity ${d.opacity.toFixed(3)} while filling ${Math.round(d.coverage * 100)}% of the viewport`,
          );
        }
      }
    }

    // Positive control, per section. An unfaded section sits at opacity 1 for
    // the whole walk, which satisfies the check above without exercising it —
    // which is how this test first passed against a build it could not fail.
    //
    // This has to be asserted per section, not once for the page. Each section
    // binds its own `useScrollAnimation` call, so they drop out one at a time;
    // a single page-wide flag is satisfied by whichever section still fades and
    // goes on passing while another is silently unbound. Deleting `#contact`'s
    // fade — the one this file exists to pin — is invisible to a page-wide flag.
    expect(
      [...seenFading].sort(),
      "every section should be caught partway through its fade; a section that is never partial is not bound to the scrollbar at all, and its assertions below are vacuous",
    ).toEqual([...SECTIONS].sort());

    expect(
      [...seenReading].sort(),
      "every section should fill the viewport at some point in the walk",
    ).toEqual([...SECTIONS].sort());

    expect(dimWhileRead).toEqual([]);
  });

  test("the last section finishes its fade before the page runs out of scroll", async ({
    page,
  }) => {
    await navigateToHome(page);

    // #contact is last, so its scroll range ("end start") can never complete:
    // the document bottom arrives first. If the fade is spread over too much of
    // that range the section is stranded permanently dim.
    await scrollTo(
      page,
      await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      ),
    );

    const reading = await sampleSections(page);
    const contact = reading["#contact"];
    expect(contact, "#contact should be present on the homepage").toBeTruthy();
    expect(
      contact.coverage,
      "#contact should dominate the viewport at the document bottom",
    ).toBeGreaterThan(0.3);
    expect(
      contact.opacity,
      "#contact is stranded part-faded at the bottom of the page — the reader can scroll no further to finish it",
    ).toBeGreaterThan(0.99);
  });
});
