/**
 * Stills + walkthrough for the HTML resume / print-polish PR.
 * Writes into .pr-preview/ on the branch.
 */
import { mkdirSync, rmSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { previewBaseURL } from "./preview-port.mjs";

const OUT = new URL("../.pr-preview/", import.meta.url);

mkdirSync(OUT, { recursive: true });
const OWNED = new Set([
  "resume-desktop.png",
  "resume-experience.png",
  "resume-print.png",
  "resume-mobile.png",
  "resume-pdf-page1.png",
  "resume-pdf-page2.png",
  "about-section.png",
  "about-print.png",
  "walkthrough.mp4",
]);
for (const name of readdirSync(OUT)) {
  if (OWNED.has(name)) rmSync(new URL(name, OUT), { force: true, recursive: true });
}

const baseURL = previewBaseURL();
const browser = await chromium.launch();

async function shot(page, name, fullPage = false) {
  await page.waitForTimeout(250);
  await page.screenshot({
    path: new URL(`../.pr-preview/${name}`, import.meta.url).pathname,
    fullPage,
  });
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(baseURL + "/resume/", { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1, name: "Pratik Patel" }).waitFor();
  await shot(page, "resume-desktop.png");
  await page.getByRole("heading", { name: /Experience/i }).scrollIntoViewIfNeeded();
  await shot(page, "resume-experience.png");
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(400);
  await shot(page, "resume-print.png", true);
  await page.close();
}

{
  const page = await browser.newPage({
    viewport: { width: 393, height: 851 },
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(baseURL + "/resume/", { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1, name: "Pratik Patel" }).waitFor();
  await shot(page, "resume-mobile.png");
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("pratik.hero-boot-seen", "1");
    } catch {
      /* ignore */
    }
  });
  await page.goto(baseURL + "/", { waitUntil: "networkidle" });
  await page.locator("#about").scrollIntoViewIfNeeded();
  await page.getByText("about.md").waitFor();
  await shot(page, "about-section.png");
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(400);
  await shot(page, "about-print.png", true);
  await page.close();
}

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
  await page.addInitScript(() => {
    try {
      localStorage.setItem("pratik.hero-boot-seen", "1");
    } catch {
      /* ignore */
    }
  });
  await page.goto(baseURL + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.getByRole("link", { name: "resume()" }).first().click();
  await page.waitForURL(/\/resume\/?/);
  await page.getByRole("heading", { level: 1, name: "Pratik Patel" }).waitFor();
  await page.waitForTimeout(700);
  await page.getByRole("heading", { name: /Experience/i }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.getByRole("link", { name: /download resume\.pdf/i }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

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

{
  const pdf = new URL("../public/resume.pdf", import.meta.url).pathname;
  const prefix = new URL("../.pr-preview/resume-pdf-page", import.meta.url).pathname;
  const pages = spawnSync("pdftoppm", ["-png", "-r", "150", pdf, prefix], {
    stdio: "inherit",
  });
  if (pages.status !== 0) {
    throw new Error(`pdftoppm failed with ${pages.status}`);
  }
  // pdftoppm writes resume-pdf-page-1.png / -2.png; normalize to page1/page2.
  for (const name of readdirSync(OUT)) {
    const m = /^resume-pdf-page-(\d+)\.png$/.exec(name);
    if (!m) continue;
    const dest = `resume-pdf-page${m[1]}.png`;
    rmSync(new URL(dest, OUT), { force: true });
    spawnSync("mv", [new URL(name, OUT).pathname, new URL(dest, OUT).pathname], {
      stdio: "inherit",
    });
  }
}

console.log(
  "wrote .pr-preview/ resume-desktop.png, resume-experience.png, resume-print.png, resume-mobile.png, resume-pdf-page1.png, resume-pdf-page2.png, about-section.png, about-print.png, walkthrough.mp4"
);
