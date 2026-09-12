/**
 * Stills + walkthrough for the /vc/ angel investing + pitch form draft.
 * Writes into .pr-preview/ on the branch.
 */
import { mkdirSync, rmSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { previewBaseURL } from "./preview-port.mjs";

const OUT = new URL("../.pr-preview/", import.meta.url);

mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(OUT)) {
  // Only refresh VC stills + the shared walkthrough name for this PR.
  if (name.startsWith("vc-") || name === "walkthrough.mp4") {
    rmSync(new URL(name, OUT), { force: true, recursive: true });
  }
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
  await page.goto(baseURL + "/vc/", { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1, name: "Angel investing" }).waitFor();
  await shot(page, "vc-desktop.png");
  await page.getByRole("heading", { name: /Areas I am watching/i }).scrollIntoViewIfNeeded();
  await shot(page, "vc-thesis.png");
  await page.locator("#pitch").scrollIntoViewIfNeeded();
  await shot(page, "vc-form.png");
  await page.close();
}

{
  const page = await browser.newPage({
    viewport: { width: 393, height: 851 },
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(baseURL + "/vc/", { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1, name: "Angel investing" }).waitFor();
  await shot(page, "vc-mobile.png");
  await page.locator("#pitch").scrollIntoViewIfNeeded();
  await shot(page, "vc-mobile-form.png");
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(baseURL + "/vc/?sent=1", { waitUntil: "networkidle" });
  await page.getByText("// sent").waitFor();
  await shot(page, "vc-success.png");
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
  await page.waitForTimeout(900);
  await page.getByRole("link", { name: "vc()" }).first().click();
  await page.waitForURL(/\/vc\/?/);
  await page.getByRole("heading", { level: 1, name: "Angel investing" }).waitFor();
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollBy(0, 280));
  await page.waitForTimeout(900);
  await page.getByRole("heading", { name: /Areas I am watching/i }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1400);
  await page.locator("#pitch").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  await page.getByLabel(/name \*/i).click();
  await page.getByLabel(/name \*/i).pressSequentially("Ada Example", { delay: 40 });
  await page.getByLabel(/email \*/i).pressSequentially("ada@example.com", { delay: 35 });
  await page.getByLabel(/company \/ url \*/i).pressSequentially("Example Co (https://example.com)", { delay: 25 });
  await page.getByLabel(/one-liner \*/i).pressSequentially("Agent infrastructure for founder-led teams", { delay: 25 });
  await page.getByLabel(/raise \/ stage/i).pressSequentially("Pre-seed", { delay: 40 });
  await page.getByLabel(/deck url or note/i).pressSequentially("happy to send on request", { delay: 30 });
  await page.getByLabel(/^message$/i).pressSequentially("Building verify/deploy loops for coding agents.", { delay: 20 });
  await page.waitForTimeout(1200);
  // Do not submit: FormSubmit would email the live inbox.
  await page.getByRole("button", { name: /submit_pitch/i }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  // Quick mobile-width glance at the end of the same recording.
  await page.setViewportSize({ width: 393, height: 720 });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(900);
  await page.locator("#pitch").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1100);

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
  "wrote .pr-preview/ vc-desktop.png, vc-thesis.png, vc-form.png, vc-mobile.png, vc-mobile-form.png, vc-success.png, walkthrough.mp4"
);
