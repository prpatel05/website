/**
 * Desktop + mobile stills and a short filter walkthrough for the PR.
 * Writes into .pr-preview/ on the branch.
 */
import { mkdirSync, rmSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { previewBaseURL } from "./preview-port.mjs";

const ARCHIVE = "/blog/";
const HIRING = "/blog/?tag=hiring";
const EMPTY = "/blog/?tag=not-a-real-tag";
const OUT = new URL("../.pr-preview/", import.meta.url);

mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(OUT)) {
  rmSync(new URL(name, OUT), { force: true, recursive: true });
}

const baseURL = previewBaseURL();
const browser = await chromium.launch();

async function settleArchive(page) {
  await page.getByRole("heading", { name: /Blog/ }).waitFor();
  await page.getByRole("navigation", { name: "Filter by tag" }).waitFor();
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
  await page.goto(baseURL + ARCHIVE, { waitUntil: "networkidle" });
  await settleArchive(page);
  await shot(page, `${prefix}-all.png`);

  await page.goto(baseURL + HIRING, { waitUntil: "networkidle" });
  await settleArchive(page);
  await page.getByRole("heading", { name: "The Entry-Level Job Is the Canary" }).waitFor();
  await shot(page, `${prefix}-hiring.png`);

  await page.goto(baseURL + EMPTY, { waitUntil: "networkidle" });
  await page.getByText("No posts tagged #not-a-real-tag.").waitFor();
  await shot(page, `${prefix}-empty.png`);
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
  await page.goto(baseURL + ARCHIVE, { waitUntil: "networkidle" });
  await settleArchive(page);
  await page.waitForTimeout(500);
  const filter = page.getByRole("navigation", { name: "Filter by tag" });
  await filter.getByRole("link", { name: "#hiring" }).click();
  await page.waitForURL(/tag=hiring/);
  await page.getByRole("heading", { name: "The Entry-Level Job Is the Canary" }).waitFor();
  await page.waitForTimeout(900);
  await filter.getByRole("link", { name: "all", exact: true }).click();
  await page.waitForURL(/\/blog\/$/);
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
  "wrote .pr-preview/ desktop-all, desktop-hiring, desktop-empty, mobile-all, mobile-hiring, mobile-empty, walkthrough.mp4"
);
