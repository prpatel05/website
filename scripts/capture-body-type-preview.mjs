/**
 * Desktop + mobile stills and a short scroll of a long post, for the
 * body-type PR. Writes labeled files into .pr-preview/ and does not wipe
 * the other half of the before/after pair.
 *
 *   bun scripts/capture-body-type-preview.mjs before
 *   bun scripts/capture-body-type-preview.mjs after
 */
import { mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { previewBaseURL } from "./preview-port.mjs";

const PHASE = process.argv[2];
if (PHASE !== "before" && PHASE !== "after") {
  throw new Error("usage: capture-body-type-preview.mjs before|after");
}

const POST = "/blog/the-entry-level-job-is-the-canary/";
const TITLE = "The Entry-Level Job Is the Canary";
const OUT = new URL("../.pr-preview/", import.meta.url);

mkdirSync(OUT, { recursive: true });

const baseURL = previewBaseURL();
const browser = await chromium.launch();

async function settle(page) {
  await page.getByRole("heading", { name: TITLE }).waitFor();
  await page.locator("[data-post-body] p").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

async function shot(page, name) {
  await page.screenshot({
    path: new URL(`../.pr-preview/${name}`, import.meta.url).pathname,
    fullPage: false,
  });
}

async function stills(viewport, prefix) {
  const page = await browser.newPage(viewport);
  await page.goto(baseURL + POST, { waitUntil: "networkidle" });
  await settle(page);
  await shot(page, `${PHASE}-${prefix}-top.png`);

  // Mid-essay: first claim heading + the paragraphs under it, so the
  // reading column is the thing in frame rather than the hero.
  const heading = page.locator("[data-post-body] h2").first();
  await heading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await shot(page, `${PHASE}-${prefix}-body.png`);
  await page.close();
}

await stills({ viewport: { width: 1280, height: 800 } }, "desktop");
await stills(
  { viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true },
  "mobile"
);

await browser.close();

if (PHASE === "after") {
  const rec = await chromium.launch();
  const context = await rec.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: new URL("../.pr-preview/", import.meta.url).pathname,
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();
  await page.goto(baseURL + POST, { waitUntil: "networkidle" });
  await settle(page);
  await page.waitForTimeout(400);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 240) {
    await page.evaluate((top) => scrollTo(0, top), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(800);
  const video = page.video();
  await page.close();
  const src = await video.path();
  await context.close();
  await rec.close();

  const dest = new URL("../.pr-preview/scroll-reading.mp4", import.meta.url).pathname;
  const ff = spawnSync(
    "ffmpeg",
    ["-y", "-i", src, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", dest],
    { stdio: "inherit" }
  );
  if (ff.status !== 0) {
    throw new Error(`ffmpeg failed with ${ff.status}`);
  }
  rmSync(src, { force: true });
}

console.log(`wrote .pr-preview/ ${PHASE}-desktop-top/body, ${PHASE}-mobile-top/body`);
