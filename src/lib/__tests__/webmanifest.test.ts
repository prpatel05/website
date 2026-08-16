import { existsSync, readFileSync, statSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

// Read the manifest off disk rather than importing it. Vite serves public/ verbatim,
// so the file on disk is byte-for-byte what the browser fetches; an import would go
// through the JSON transform and could not catch a malformed file.
const raw = readFileSync("public/site.webmanifest", "utf8");
const manifest = JSON.parse(raw) as {
  display?: string;
  icons?: { src: string; sizes: string; type?: string; purpose?: string }[];
};

/** PNG dimensions straight out of the IHDR chunk — avoids pulling in an image lib. */
function pngSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  expect(buf.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const icons = manifest.icons ?? [];

describe("web app manifest", () => {
  it("declares the 192px and 512px icons Chrome requires to offer installation", () => {
    // `display: standalone` is a promise the browser only keeps if both sizes are
    // present. Ship one without the other and the install prompt silently never
    // fires — no console error, no visible failure, just a missing capability.
    expect(manifest.display).toBe("standalone");
    const sizes = icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("ships a maskable icon so Android does not letterbox the glyph", () => {
    // Without a maskable entry Android pads the icon onto a white backdrop and
    // shrinks it; the mark is a dark rounded square, so it reads as a small dark
    // blob. The maskable variant renders the glyph into the central 80% safe zone.
    const maskable = icons.filter((i) => i.purpose === "maskable");
    expect(maskable.length).toBeGreaterThan(0);
    expect(maskable.some((i) => i.sizes === "512x512")).toBe(true);
  });

  it("the maskable icon keeps its mark inside the 80% safe circle", async () => {
    // A maskable icon is never shown as drawn: the launcher applies its own mask
    // — a circle on Pixel, a squircle elsewhere — and only the central 80%
    // *circle* survives it. The tile that shipped before this test scaled the
    // artwork to 410.7px, within a pixel of 409.6 = 80% of 512, so it had been
    // fitted to the safe-zone **square**. The mark is a rounded square, whose
    // corners sit further from the centre than its edges: they reached radius
    // 217.9 against a safe radius of 204.8, and a circular mask took 13px off
    // each corner of a 30px stroke. The window outline rendered as four
    // disconnected arcs. Asserting a 512x512 maskable entry exists — all this
    // file used to do — cannot see that, because the file was the right size.
    const maskable = icons.filter((i) => i.purpose === "maskable");
    expect(maskable.length).toBeGreaterThan(0);

    for (const icon of maskable) {
      const { data, info } = await sharp(`public${icon.src}`)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const px = (x: number, y: number) => (y * info.width + x) * info.channels;

      // A maskable icon must be opaque edge to edge — a transparent margin gets
      // letterboxed and the mask then cuts the artwork instead of the backdrop.
      // That also makes the corner a sound read of the backdrop colour, which
      // the mark test below classifies against.
      let transparent = 0;
      for (let i = 3; i < data.length; i += info.channels) {
        if (data[i] < 255) transparent += 1;
      }
      expect(transparent, `${icon.src} has ${transparent} non-opaque pixels`).toBe(0);

      const corners = [
        [0, 0],
        [info.width - 1, 0],
        [0, info.height - 1],
        [info.width - 1, info.height - 1],
      ].map(([x, y]) => [...data.subarray(px(x, y), px(x, y) + 3)]);
      for (const corner of corners) {
        expect(corner, `${icon.src} is not a flat full-bleed backdrop`).toEqual(corners[0]);
      }
      const [br, bg, bb] = corners[0];

      // Classify mark-vs-backdrop with an explicit threshold. In this artwork the
      // mark colours sit at euclidean RGB distance 38 (the frame stroke #1a1f2e),
      // 267 (#00ff80) and 289 (#a855f7) from the #0a0c10 backdrop, so 19 is the
      // midpoint to the nearest of them — the 50%-coverage contour of an
      // antialiased edge. The measurement barely depends on the choice: every
      // threshold from 1 to 37 puts the outermost pixel within a pixel of the
      // same radius. Picking one above 38 would silently drop the frame and
      // measure only the two glyphs, which is the way this test could go vacuous.
      // Measure against the raster's own dimensions rather than the `sizes` the
      // manifest declares — a file that disagreed with its declaration would
      // otherwise be measured about the wrong centre. (Another test in this file
      // asserts the two match; this just does not depend on that one running.)
      const THRESHOLD = 19;
      const centre = info.width / 2;
      const safeRadius = (0.8 * info.width) / 2;
      let maxRadius = 0;
      let mark = 0;
      for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
          const i = px(x, y);
          const distance = Math.hypot(data[i] - br, data[i + 1] - bg, data[i + 2] - bb);
          if (distance < THRESHOLD) continue;
          mark += 1;
          maxRadius = Math.max(maxRadius, Math.hypot(x + 0.5 - centre, y + 0.5 - centre));
        }
      }

      expect(mark, `${icon.src} has no mark to measure`).toBeGreaterThan(0);
      expect(
        maxRadius,
        `${icon.src} paints out to radius ${maxRadius.toFixed(1)}px, past the ${safeRadius}px safe circle — a circular launcher mask will cut it`
      ).toBeLessThanOrEqual(safeRadius);

      // Two-sided on purpose. Shrinking the artwork until nothing reaches the
      // edge would satisfy the assertion above while making the icon a speck in
      // a field of backdrop, and deleting the frame outright would leave only
      // the glyphs, which reach ~124px here. The mark is meant to fill the safe
      // zone, not merely avoid it.
      expect(
        maxRadius,
        `${icon.src} only reaches radius ${maxRadius.toFixed(1)}px of ${safeRadius}px — the mark is too small for the safe zone`
      ).toBeGreaterThan(0.85 * safeRadius);
    }
  });

  it("every declared icon exists and is exactly the size it claims", () => {
    // A manifest that points at a missing file, or lies about dimensions, is worse
    // than no manifest: the browser accepts it and then renders a broken icon.
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      const path = `public${icon.src}`;
      expect(existsSync(path), `${icon.src} is declared but missing`).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(0);

      const [w, h] = icon.sizes.split("x").map(Number);
      expect(pngSize(path), `${icon.src} does not match its declared sizes`).toEqual({
        width: w,
        height: h,
      });
    }
  });

  it("the apple-touch-icon is fully opaque", async () => {
    // iOS ignores alpha in a home-screen icon: it composites onto black, then
    // applies its own superellipse mask at the full tile size. A transparent
    // margin therefore survives the mask as a black band, and the tile reads
    // smaller than every neighbouring app icon and is ringed in #000000. This
    // shipped for real — 30.3% of the tile was alpha 0, a 13px margin all round.
    //
    // The other icons are deliberately not held to this: a favicon paints over
    // browser chrome that may be light or dark, and Android gets its opaque
    // tile from the separate `maskable` entry.
    //
    // Read the href out of index.html rather than the manifest — the `<link
    // rel="apple-touch-icon">` is what iOS actually reads, and the manifest
    // does not drive the home-screen icon at all.
    const html = readFileSync("index.html", "utf8");
    const href = html.match(
      /<link[^>]*rel="apple-touch-icon"[^>]*href="([^"]+)"/
    )?.[1];
    expect(href, "index.html declares no apple-touch-icon").toBeDefined();

    const image = sharp(`public${href}`);
    const { width, height } = await image.metadata();
    expect({ width, height }).toEqual({ width: 180, height: 180 });

    // Count alpha rather than trusting the channel count: an RGBA png whose
    // alpha is uniformly 255 is opaque too, and regenerating through a
    // different tool could reasonably produce either.
    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let transparent = 0;
    for (let i = 3; i < data.length; i += info.channels) {
      if (data[i] < 255) transparent += 1;
    }
    expect(
      transparent,
      `${href} has ${transparent} non-opaque pixels; iOS will flatten those to black`
    ).toBe(0);
  });
});
