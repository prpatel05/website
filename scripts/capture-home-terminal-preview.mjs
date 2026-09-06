/**
 * Stills + walkthrough for the home terminal / selected writing / CRT PR.
 * Writes into .pr-preview/ on the branch.
 */
import { mkdirSync, rmSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { previewBaseURL } from "./preview-port.mjs";

const OUT = new URL("../.pr-preview/", import.meta.url);

mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(OUT)) {
  rmSync(new URL(name, OUT), { force: true, recursive: true });
}

const baseURL = previewBaseURL();
const browser = await chromium.launch();

async function shot(page, name) {
  await page.waitForTimeout(250);
  await page.screenshot({
    path: new URL(`../.pr-preview/${name}`, import.meta.url).pathname,
    fullPage: false,
  });
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("pratik.hero-boot-seen", "1");
      localStorage.removeItem("pratik.crt-noise");
    } catch {
      /* ignore */
    }
  });
  await page.goto(baseURL + "/", { waitUntil: "networkidle" });
  await page.getByText("Pratik").first().waitFor();
  await shot(page, "home-hero-settled.png");

  await page.locator("#writing").scrollIntoViewIfNeeded();
  await page.getByText("Selected").first().waitFor();
  await shot(page, "home-selected-writing.png");

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole("button", { name: /Turn CRT noise on/i }).click();
  await page.locator(".crt-noise").waitFor();
  await shot(page, "home-crt-on.png");

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('button[title="Open terminal (Ctrl+K)"]').click();
  await page.getByPlaceholder('type "help" to get started...').waitFor();
  await page.getByPlaceholder('type "help" to get started...').fill("help");
  await page.keyboard.press("Enter");
  await page.getByText("┌─ Available Commands").waitFor();
  await shot(page, "home-terminal-help.png");

  await page.getByPlaceholder('type "help" to get started...').fill("ls blog");
  await page.keyboard.press("Enter");
  await page.getByText("./blog").waitFor();
  await shot(page, "home-terminal-ls-blog.png");
  await page.close();
}

{
  const page = await browser.newPage({
    viewport: { width: 393, height: 851 },
    isMobile: true,
    hasTouch: true,
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("pratik.hero-boot-seen", "1");
    } catch {
      /* ignore */
    }
  });
  await page.goto(baseURL + "/", { waitUntil: "networkidle" });
  await page.locator("#writing").scrollIntoViewIfNeeded();
  await page.getByText("Selected").first().waitFor();
  await shot(page, "mobile-selected-writing.png");
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
  await context.addInitScript(() => {
    try {
      localStorage.setItem("pratik.hero-boot-seen", "1");
      localStorage.removeItem("pratik.crt-noise");
    } catch {
      /* ignore */
    }
  });
  const page = await context.newPage();
  await page.goto(baseURL + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.locator("#writing").scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.locator('button[title="Open terminal (Ctrl+K)"]').click();
  const input = page.getByPlaceholder('type "help" to get started...');
  await input.waitFor();
  await input.fill("whoami");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  await input.fill("open blog");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/blog\/?$/);
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

console.log(
  "wrote .pr-preview/ home-hero-settled, home-selected-writing, home-crt-on, home-terminal-help, home-terminal-ls-blog, mobile-selected-writing, walkthrough.mp4"
);
