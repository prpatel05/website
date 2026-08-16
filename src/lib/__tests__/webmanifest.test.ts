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
