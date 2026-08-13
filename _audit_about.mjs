import { chromium } from "@playwright/test";
import { serveDist } from "./scripts/static-dist-server.mjs";

const { base, close } = await serveDist();
const browser = await chromium.launch();

const probe = () => {
  const sec = document.querySelector("section.min-h-screen");
  const secR = sec.getBoundingClientRect();
  const container = sec.querySelector("div.container");
  const links = [...sec.querySelectorAll("a")];
  const eff = (el) => {
    let o = 1, n = el;
    while (n && n !== document.documentElement) { o *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
    return o;
  };
  const rows = links.map((a) => {
    const r = a.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const insideVp = cy > 0 && cy < window.innerHeight && cx > 0 && cx < window.innerWidth;
    const clippedByHero = cy < secR.top || cy > secR.bottom;
    const hitEl = insideVp ? document.elementFromPoint(cx, cy) : null;
    return {
      text: a.textContent.trim(),
      top: Math.round(r.top), bottom: Math.round(r.bottom),
      cx: Math.round(cx), cy: Math.round(cy),
      insideVp, clippedByHero,
      op: Math.round(eff(a) * 10000) / 10000,
      topmost: hitEl ? (a.contains(hitEl) || hitEl === a) : null,
      hitTag: hitEl ? hitEl.tagName + "." + String(hitEl.className).slice(0, 25) : null,
    };
  });
  return {
    y: window.scrollY,
    secTop: Math.round(secR.top), secBottom: Math.round(secR.bottom),
    inlineOpacity: container.style.opacity, inlineTransform: container.style.transform,
    computedOpacity: getComputedStyle(container).opacity,
    rows,
  };
};

async function sweep(vp) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  const heroH = await page.evaluate(() => document.querySelector("section.min-h-screen").getBoundingClientRect().height);
  console.log(`\n=== ${vp.width}x${vp.height} heroH=${heroH} ===`);
  const ghosts = [];
  for (let y = Math.round(heroH * 0.6); y <= Math.round(heroH * 1.05); y += 10) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(70);
    const s = await page.evaluate(probe);
    for (const r of s.rows) {
      if (r.insideVp && !r.clippedByHero && r.topmost && r.op < 0.06) {
        ghosts.push({ y: s.y, ...r, inline: s.inlineOpacity });
      }
    }
  }
  console.log(`ghost samples (in viewport, not clipped by hero, topmost at centre, effective opacity < 0.06): ${ghosts.length}`);
  for (const g of ghosts) console.log("  ", JSON.stringify(g));

  if (ghosts.length) {
    const g = ghosts[Math.floor(ghosts.length / 2)];
    await page.evaluate((yy) => window.scrollTo(0, yy), g.y);
    await page.waitForTimeout(300);
    const before = await page.evaluate(probe);
    const target = before.rows.find((r) => r.text === g.text);
    console.log("  RE-CHECK at y=" + g.y + ":", JSON.stringify(target));
    const urlBefore = page.url();
    const yBefore = await page.evaluate(() => window.scrollY);
    // a real tap at those screen coordinates - no locator scrolling
    await page.mouse.click(target.cx, target.cy);
    await page.waitForTimeout(900);
    console.log(`  TAP at (${target.cx},${target.cy}) -> url ${urlBefore} => ${page.url()} ; scrollY ${yBefore} => ${await page.evaluate(() => window.scrollY)}`);
    // negative control: is anything else there? what does the reader think they tapped?
    const painted = await page.screenshot({ clip: { x: Math.max(0, target.cx - 120), y: Math.max(0, target.cy - 30), width: 240, height: 60 } });
    const { writeFileSync } = await import("fs");
    writeFileSync(`/tmp/ghost-${vp.width}.png`, painted);
  }
  await ctx.close();
}

await sweep({ width: 393, height: 852 });
await sweep({ width: 1440, height: 900 });
await sweep({ width: 1024, height: 600 });

await browser.close();
close();
