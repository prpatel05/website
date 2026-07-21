/**
 * Renders the homepage social card (og:image) to public/images/social-card.png.
 *
 * The homepage previously shared headshot.png (556x556), which is below the
 * 1200x630 threshold LinkedIn and Facebook require to render the large hero
 * card — so the most-shared URL on the site degraded to a small thumbnail.
 *
 * Run manually after changing scripts/social-card.html:
 *   node scripts/generate-social-card.mjs
 *
 * Not wired into `bun run build`: the card is a static asset that changes only
 * when the copy or brand does, and the build shouldn't need a browser.
 */
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "social-card.html");
const output = resolve(here, "../public/images/social-card.png");

const WIDTH = 1200;
const HEIGHT = 630;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});

await page.goto(pathToFileURL(source).href, { waitUntil: "networkidle" });
// Webfonts load from Google Fonts; screenshot only once they're swapped in.
await page.evaluate(() => document.fonts.ready);

await page.screenshot({ path: output, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
await browser.close();

console.log(`Wrote ${output} (${WIDTH}x${HEIGHT})`);
