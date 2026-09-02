/**
 * Desktop + mobile stills and a short copy-link walkthrough for the PR.
 * Writes into .pr-preview/ on the branch.
 */
import { mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { previewBaseURL } from "./preview-port.mjs";

const POST = "/blog/the-entry-level-job-is-the-canary/";
const OUT = new URL("../.pr-preview/", import.meta.url);
const WEBM = new URL("../.pr-preview/walkthrough.webm", import.meta.url);

mkdirSync(OUT, { recursive: true });

const baseURL = previewBaseURL();

const browser = await chromium.launch();

async function shot(page, name) {
  const row = page.getByText("// share");
  await row.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({
    path: new URL(`../.pr-preview/${name}`, import.meta.url).pathname,
    fullPage: false,
  });
}

// Desktop stills
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(baseURL + POST, { waitUntil: "networkidle" });
  await page.getByText("// share").waitFor();
  await shot(page, "desktop-row.png");

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "copy url" }).click();
  await page.getByRole("button", { name: "copied" }).waitFor();
  await shot(page, "desktop-copied.png");
  await page.close();
}

// Mobile stills
{
  const page = await browser.newPage({
    viewport: { width: 393, height: 851 },
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(baseURL + POST, { waitUntil: "networkidle" });
  await page.getByText("// share").waitFor();
  await shot(page, "mobile-row.png");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "copy url" }).click();
  await page.getByRole("button", { name: "copied" }).waitFor();
  await shot(page, "mobile-copied.png");
  await page.close();
}

await browser.close();

// Walkthrough video: scroll to the row, copy the link, show "copied".
{
  const rec = await chromium.launch();
  const context = await rec.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: new URL("../.pr-preview/", import.meta.url).pathname,
      size: { width: 1280, height: 720 },
    },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  await page.goto(baseURL + POST, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.evaluate(async () => {
    const row = [...document.querySelectorAll("p")].find((p) => p.textContent === "// share");
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "copy url" }).click();
  await page.getByRole("button", { name: "copied" }).waitFor();
  await page.waitForTimeout(1400);
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
  rmSync(WEBM, { force: true });
}

console.log("wrote .pr-preview/ desktop-row, desktop-copied, mobile-row, mobile-copied, walkthrough.mp4");
