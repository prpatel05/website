/**
 * Desktop + mobile stills of the series hub, plus a short walkthrough:
 * hub → click a post → rail shows the series name linking back.
 * Writes into .pr-preview/ on the branch.
 */
import { mkdirSync, rmSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { previewBaseURL } from "./preview-port.mjs";

const HUB = "/blog/series/agent-reliability/";
const OUT = new URL("../.pr-preview/", import.meta.url);

mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(OUT)) {
  rmSync(new URL(name, OUT), { force: true, recursive: true });
}

const baseURL = previewBaseURL();
const browser = await chromium.launch();

const rail = (page) => page.getByRole("navigation", { name: "Agent reliability" });

async function shot(page, name) {
  await page.waitForTimeout(200);
  await page.screenshot({
    path: new URL(`../.pr-preview/${name}`, import.meta.url).pathname,
    fullPage: false,
  });
}

async function stills(viewport, prefix) {
  const page = await browser.newPage(viewport);
  await page.goto(baseURL + HUB, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.getByRole("heading", { name: "Agents Fail Quietly" }).waitFor();
  await shot(page, `${prefix}-hub.png`);
  await page.close();
}

await stills({ viewport: { width: 1280, height: 800 } }, "desktop");
await stills(
  { viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true },
  "mobile"
);

await browser.close();

{
  const rec = await chromium.launch();
  const context = await rec.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: new URL("../.pr-preview/", import.meta.url).pathname,
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();
  await page.goto(baseURL + HUB, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1, name: "Agent reliability" }).waitFor();
  await page.waitForTimeout(600);
  await page.getByRole("link", { name: "Give Your Agent an Undo Button" }).click();
  await page.waitForURL(/give-your-agent-an-undo-button/);
  await page.getByRole("heading", { name: "Give Your Agent an Undo Button" }).waitFor();
  await rail(page).first().waitFor();
  await rail(page).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await expectSeriesLink(page);
  await page.waitForTimeout(1000);

  const video = page.video();
  await page.close();
  const src = await video.path();
  await context.close();
  await rec.close();

  const dest = new URL("../.pr-preview/walkthrough.mp4", import.meta.url).pathname;
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

async function expectSeriesLink(page) {
  await rail(page)
    .first()
    .getByRole("link", { name: "Agent reliability" })
    .waitFor();
}

console.log(
  "wrote .pr-preview/ desktop-hub.png, mobile-hub.png, walkthrough.mp4"
);
