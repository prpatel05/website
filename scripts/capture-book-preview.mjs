/**
 * Stills + walkthrough for the /book/ Cal.com booking page PR.
 *
 *   BOOK_CAPTURE_PHASE=before node scripts/capture-book-preview.mjs  # on a main build
 *   node scripts/capture-book-preview.mjs                            # on this branch
 *
 * Serves dist/ in-process (no preview server to clean up) and writes
 * .pr-preview/book-*.png plus .pr-preview/book-walkthrough.mp4. The /book/
 * shots load the real Cal.com embed, so they need network access.
 */
import { mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { serveDist } from "./static-dist-server.mjs";

const PHASE = process.env.BOOK_CAPTURE_PHASE === "before" ? "before" : "after";
const OUT = new URL("../.pr-preview/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const out = (name) => new URL(name, OUT).pathname;

const { base, close } = await serveDist();
const browser = await chromium.launch();

const DESKTOP = { viewport: { width: 1280, height: 800 } };
const MOBILE = { viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true };

async function newPage(opts) {
  const context = await browser.newContext(opts);
  await context.addInitScript(() => {
    try {
      localStorage.setItem("pratik.hero-boot-seen", "1");
    } catch {
      /* ignore */
    }
  });
  return { context, page: await context.newPage() };
}

async function shootElement(opts, path, selector, name) {
  const { context, page } = await newPage(opts);
  await page.goto(base + path, { waitUntil: "networkidle" });
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await el.screenshot({ path: out(name) });
  await context.close();
}

// Chrome the PR touches: home contact CTA, footer sitemap, /vc/ pitch intro.
for (const [label, opts] of [["desktop", DESKTOP], ["mobile", MOBILE]]) {
  await shootElement(opts, "/", "#contact", `book-${PHASE}-home-contact-${label}.png`);
  await shootElement(opts, "/resume/", "footer", `book-${PHASE}-footer-${label}.png`);
}
await shootElement(DESKTOP, "/vc/", "#pitch", `book-${PHASE}-vc-pitch-desktop.png`);

if (PHASE === "after") {
  // The page itself with the live Cal.com embed rendered.
  for (const [label, opts] of [["desktop", DESKTOP], ["mobile", MOBILE]]) {
    const { context, page } = await newPage(opts);
    await page.goto(base + "/book/", { waitUntil: "domcontentloaded" });
    await page.frameLocator('iframe[name="cal-embed=prpatel05-30min"], iframe[src*="cal.com"]').first()
      .locator("body").waitFor({ timeout: 30000 });
    await page.locator('[data-cal-state="ready"]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: out(`book-${label}.png`) });
    await page.screenshot({ path: out(`book-${label}-full.png`), fullPage: true });
    await context.close();
  }

  // Embed blocked (ad blocker, Cal down): the fallback link takes over.
  {
    const { context, page } = await newPage(DESKTOP);
    await context.route(/https:\/\/(app\.)?cal\.com\//, (route) => route.abort());
    await page.goto(base + "/book/", { waitUntil: "domcontentloaded" });
    await page.locator('[data-cal-state="failed"]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: out("book-fallback-desktop.png") });
    await context.close();
  }

  // JS off: the prerendered page alone.
  {
    const context = await browser.newContext({ ...DESKTOP, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(base + "/book/");
    await page.waitForTimeout(400);
    await page.screenshot({ path: out("book-nojs-desktop.png") });
    await context.close();
  }

  // Walkthrough: home contact CTA -> /book/ -> embed renders -> pick a day.
  {
    const dir = out("book-video-tmp/");
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir, size: { width: 1280, height: 720 } },
    });
    await context.addInitScript(() => {
      try {
        localStorage.setItem("pratik.hero-boot-seen", "1");
      } catch {
        /* ignore */
      }
    });
    const page = await context.newPage();
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await page.locator("#contact").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1400);
    await page.getByRole("link", { name: /book a call/i }).first().click();
    await page.waitForURL(/\/book\/?$/);
    await page.locator('[data-cal-state="ready"]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(2500);
    const frame = page.frameLocator('iframe[src*="cal.com"]').first();
    const day = frame.locator('button[data-testid="day"]:not([disabled])').first();
    if (await day.count()) {
      await day.scrollIntoViewIfNeeded();
      await day.click();
      await page.waitForTimeout(2500);
    }
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(1500);
    const video = page.video();
    await context.close();
    const src = await video.path();
    const ff = spawnSync(
      "ffmpeg",
      ["-y", "-loglevel", "error", "-i", src, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", out("book-walkthrough.mp4")],
      { stdio: "inherit" }
    );
    rmSync(dir, { recursive: true, force: true });
    if (ff.status !== 0) throw new Error(`ffmpeg failed with ${ff.status}`);
  }
}

await browser.close();
close();
console.log(`wrote .pr-preview/book-* (${PHASE})`);
