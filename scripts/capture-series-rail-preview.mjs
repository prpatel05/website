/**
 * Desktop + mobile stills and a short series-rail walkthrough for the PR.
 * Writes into .pr-preview/ on the branch.
 */
import { mkdirSync, rmSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { previewBaseURL } from "./preview-port.mjs";

const MEMBER = "/blog/give-your-agent-an-undo-button/";
const FIRST = "/blog/agents-fail-quietly/";
const NON_MEMBER = "/blog/the-entry-level-job-is-the-canary/";
const OUT = new URL("../.pr-preview/", import.meta.url);

mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(OUT)) {
  rmSync(new URL(name, OUT), { force: true, recursive: true });
}

const baseURL = previewBaseURL();
const browser = await chromium.launch();

const rail = (page) => page.getByRole("navigation", { name: "Agent reliability" });

async function settleMember(page) {
  await page.getByRole("heading", { level: 1 }).waitFor();
  await rail(page).first().waitFor();
}

async function shot(page, name) {
  await page.waitForTimeout(200);
  await page.screenshot({
    path: new URL(`../.pr-preview/${name}`, import.meta.url).pathname,
    fullPage: false,
  });
}

async function stills(viewport, prefix) {
  const page = await browser.newPage(viewport);
  await page.goto(baseURL + MEMBER, { waitUntil: "networkidle" });
  await settleMember(page);
  await rail(page).first().scrollIntoViewIfNeeded();
  await shot(page, `${prefix}-member.png`);

  await page.goto(baseURL + NON_MEMBER, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "The Entry-Level Job Is the Canary" }).waitFor();
  await shot(page, `${prefix}-non-member.png`);
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
  await page.goto(baseURL + FIRST, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Agents Fail Quietly" }).waitFor();
  await rail(page).first().waitFor();
  await page.waitForTimeout(600);
  await rail(page).first().getByRole("link", { name: /next/ }).click();
  await page.waitForURL(/give-your-agent-an-undo-button/);
  await page.getByRole("heading", { name: "Give Your Agent an Undo Button" }).waitFor();
  await page.waitForTimeout(800);
  await rail(page).first().getByRole("link", { name: /next/ }).click();
  await page.waitForURL(/teach-your-agent-to-ask-for-help/);
  await page.getByRole("heading", { name: "Teach Your Agent to Ask for Help" }).waitFor();
  await page.waitForTimeout(1200);
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

console.log(
  "wrote .pr-preview/ desktop-member, desktop-non-member, mobile-member, mobile-non-member, walkthrough.mp4"
);
