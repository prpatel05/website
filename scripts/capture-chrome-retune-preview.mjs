/**
 * Stills + walkthrough for the chrome retune PR.
 * Writes into .pr-preview/ on the branch.
 *
 * Usage:
 *   node scripts/capture-chrome-retune-preview.mjs          # after shots + video
 *   node scripts/capture-chrome-retune-preview.mjs --before # before-* stills only
 */
import { mkdirSync, rmSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { previewBaseURL } from "./preview-port.mjs";

const BEFORE = process.argv.includes("--before");
const OUT = new URL("../.pr-preview/", import.meta.url);
const prefix = BEFORE ? "before-" : "";

mkdirSync(OUT, { recursive: true });

if (!BEFORE) {
  // Keep before-* stills; clear everything else from a prior after run.
  for (const name of readdirSync(OUT)) {
    if (name.startsWith("before-")) continue;
    rmSync(new URL(name, OUT), { force: true, recursive: true });
  }
}

const baseURL = previewBaseURL();
const browser = await chromium.launch();

async function settleBoot(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("pratik.hero-boot-seen", "1");
      localStorage.removeItem("pratik.crt-noise");
    } catch {
      /* ignore */
    }
  });
}

async function shot(page, name, fullPage = false) {
  await page.waitForTimeout(300);
  await page.screenshot({
    path: new URL(`../.pr-preview/${prefix}${name}`, import.meta.url).pathname,
    fullPage,
  });
}

async function revealJumpRail(page) {
  await page.evaluate(() => {
    const about = document.getElementById("about");
    if (!about) throw new Error("#about missing");
    const y = about.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo(0, Math.max(0, y));
    window.dispatchEvent(new Event("scroll"));
  });
  await page.getByRole("navigation", { name: "On this page" }).waitFor();
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await settleBoot(page);
  await page.goto(baseURL + "/", { waitUntil: "networkidle" });
  await page.getByText("Pratik").first().waitFor();
  await revealJumpRail(page);
  await shot(page, "home-jump-rail.png");

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByLabel("Build status").waitFor();
  await shot(page, "home-footer-status.png");

  await page.getByRole("button", { name: /Turn CRT noise on/i }).click();
  await page.locator(".crt-noise").waitFor();
  await shot(page, "home-footer-crt-on.png");
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(baseURL + "/blog/", { waitUntil: "networkidle" });
  await page.getByRole("navigation", { name: "Main" }).waitFor();
  await shot(page, "blog-breadcrumbs.png");

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByLabel("Build status").waitFor();
  await shot(page, "blog-footer-status.png");
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(baseURL + "/blog/ship-it-yourself/", { waitUntil: "networkidle" });
  await page.getByRole("navigation", { name: "Main" }).waitFor();
  await shot(page, "post-chrome.png");
  await page.close();
}

{
  const page = await browser.newPage({
    viewport: { width: 393, height: 851 },
    isMobile: true,
    hasTouch: true,
  });
  await settleBoot(page);
  await page.goto(baseURL + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByLabel("Build status").waitFor();
  await shot(page, "mobile-footer-status.png");

  await page.goto(baseURL + "/blog/the-handoff-is-where-agents-break/", {
    waitUntil: "networkidle",
  });
  await page.getByRole("navigation", { name: "Main" }).waitFor();
  await shot(page, "mobile-breadcrumbs.png");
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await settleBoot(page);
  await page.goto(baseURL + "/", { waitUntil: "networkidle" });
  await page.locator("#writing").scrollIntoViewIfNeeded();
  await page.getByText("Selected").first().waitFor();
  await shot(page, "selected-writing-cards.png");
  await page.close();
}

await browser.close();

if (BEFORE) {
  console.log("Wrote before-* stills to .pr-preview/");
  process.exit(0);
}

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
  await settleBoot(page);
  await page.goto(baseURL + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await revealJumpRail(page);
  await page.waitForTimeout(700);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Turn CRT noise on/i }).click();
  await page.waitForTimeout(600);
  await page.goto(baseURL + "/blog/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.goto(baseURL + "/blog/ship-it-yourself/", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  await page.goto(baseURL + "/resume/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await context.close();
  await rec.close();

  const vids = readdirSync(OUT).filter((n) => n.endsWith(".webm"));
  if (vids.length === 0) throw new Error("no walkthrough video recorded");
  const src = new URL(vids[vids.length - 1], OUT).pathname;
  const mp4 = new URL("walkthrough.mp4", OUT).pathname;
  const ff = spawnSync(
    "ffmpeg",
    ["-y", "-i", src, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", mp4],
    { stdio: "inherit" }
  );
  if (ff.status !== 0) throw new Error("ffmpeg failed");
  for (const n of vids) rmSync(new URL(n, OUT), { force: true });
  console.log("Wrote after stills + walkthrough.mp4 to .pr-preview/");
}
