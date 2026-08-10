/**
 * Fails if the homepage downloads the Hero portrait on a phone, or stops
 * downloading it where it is actually painted.
 *
 * The portrait wrapper is `hidden md:block`, and `display:none` does not cancel
 * an eager fetch. Left eager, the portrait was the only image the homepage
 * requested, so 100% of a phone's homepage image payload went to a 0x0 element
 * — and it selected the *larger* candidate, because a `sizes` of 224px at DPR
 * 2.75 asks for 616 device px. A `<source media="(max-width: 767px)">` carrying
 * a blank inline pixel takes that range instead.
 *
 * The md-and-up half of this check is the other half of the guard: the cheap
 * fix for the phone is `loading="lazy"`, which also works, but it hides the
 * image from the preload scanner at every width and at 768px the portrait is
 * the LCP element. So "phone asks for nothing" alone is a target you can hit
 * while making the page worse; both directions are asserted here.
 *
 * Runs against the prerendered dist/ over a plain static server — see
 * static-dist-server.mjs for why not `vite preview`.
 */
import { chromium, devices } from "playwright";
import { serveDist } from "./static-dist-server.mjs";
import { PORTRAIT_WIDTHS } from "./portrait.mjs";

const SMALLEST = Math.min(...PORTRAIT_WIDTHS);
const LARGEST = Math.max(...PORTRAIT_WIDTHS);
const variant = (w) => `/images/portrait/headshot-${w}w.webp`;

const cases = [
  // Below md. The box does not exist, so nothing may be requested.
  { name: "Pixel 5    (393w, dpr 2.75)", opts: { ...devices["Pixel 5"] }, expect: null },
  { name: "iPhone 12  (390w, dpr 3)", opts: { ...devices["iPhone 12"] }, expect: null },
  // At and above md the portrait paints, so it must still be fetched — eagerly,
  // and at the width the box actually asks for.
  { name: "iPad Mini  (768w, dpr 2)", opts: { ...devices["iPad Mini"] }, expect: variant(LARGEST) },
  { name: "desktop 1x (1280w, dpr 1)", opts: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 }, expect: variant(SMALLEST) },
  { name: "desktop 2x (1280w, dpr 2)", opts: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 }, expect: variant(LARGEST) },
];

const { base, close } = await serveDist();
const browser = await chromium.launch();
let failed = false;

for (const { name, opts, expect } of cases) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  const images = [];

  page.on("request", (req) => {
    const path = new URL(req.url()).pathname;
    if (path.startsWith("/images/")) images.push(path);
  });

  await page.goto(`${base}/`, { waitUntil: "networkidle" });

  // Paired with the request count so a page that failed to render — which
  // requests nothing and would pass the "phone asks for nothing" half on its
  // own — is caught instead of counted as a win.
  const painted = await page.evaluate(() => {
    const img = document.querySelector('img[alt="Pratik Patel"]');
    if (!img) return { present: false };
    const r = img.getBoundingClientRect();
    return { present: true, width: Math.round(r.width), loading: img.getAttribute("loading") };
  });

  const problems = [];
  if (!painted.present) problems.push("no portrait <img> in the page at all");
  if (painted.loading === "lazy") {
    problems.push("portrait is loading=lazy, which costs the LCP at md");
  }

  if (expect === null) {
    if (images.length) problems.push(`expected no image requests, got ${images.join(", ")}`);
    if (painted.width) problems.push(`expected a 0-width box, got ${painted.width}px`);
  } else {
    if (images.length !== 1) problems.push(`expected exactly 1 image request, got ${images.length}: ${images.join(", ") || "(none)"}`);
    else if (images[0] !== expect) problems.push(`expected ${expect}, got ${images[0]}`);
    if (!painted.width) problems.push("expected a painted box, got 0px");
  }

  if (problems.length) failed = true;
  console.log(`${problems.length ? "FAIL" : "PASS"}  ${name}`);
  console.log(`      ${images.length} image request(s): ${images.join(", ") || "(none)"}; box ${painted.width ?? "-"}px`);
  for (const problem of problems) console.log(`      -> ${problem}`);

  await context.close();
}

await browser.close();
close();

process.exit(failed ? 1 : 0);
