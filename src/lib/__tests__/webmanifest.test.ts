import { existsSync, readFileSync, statSync } from "node:fs";
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
});
