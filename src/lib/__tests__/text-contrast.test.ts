import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Read the palette off disk, not through the app: a Vite transform must not be
// able to change what this test is checking.
const css = readFileSync("src/index.css", "utf8");

function token(name: string): [number, number, number] {
  const m = css.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
  if (!m) throw new Error(`missing --${name} in src/index.css`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  const hh = h / 360;
  const ss = s / 100;
  const ll = l / 100;
  const f = (n: number) => {
    const k = (n + hh * 12) % 12;
    const a = ss * Math.min(ll, 1 - ll);
    return ll - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function luminance([r, g, b]: [number, number, number]) {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg: [number, number, number], bg: [number, number, number], alpha: number) {
  const mixed = fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)) as [number, number, number];
  const [hi, lo] = [luminance(mixed), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

// --card (8% lightness) is the lightest surface light text sits on, so it is the
// worst case; --background (5%) gives every token slightly more contrast.
const surface = hslToRgb(token("card"));

const FOREGROUNDS = ["foreground", "primary", "accent", "muted-foreground", "secondary-foreground", "card-foreground"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

describe("text contrast", () => {
  // A dimmed token is how contrast regressions get in: the solid palette all
  // clears AA, an opacity suffix silently drops it under it.
  const usages = sourceFiles("src").flatMap((file) => {
    const text = readFileSync(file, "utf8");
    return [...text.matchAll(/text-([a-z-]+)\/(\d+)/g)]
      .filter((m) => FOREGROUNDS.includes(m[1]))
      .map((m) => ({ file, cls: m[0], name: m[1], alpha: Number(m[2]) / 100 }));
  });

  it("finds the dimmed text classes to check", () => {
    expect(usages.length).toBeGreaterThan(0);
  });

  it("keeps every dimmed text class at WCAG AA (4.5:1)", () => {
    const failing = usages
      .filter((u) => contrast(hslToRgb(token(u.name)), surface, u.alpha) < 4.5)
      .map((u) => `${u.file}: ${u.cls} = ${contrast(hslToRgb(token(u.name)), surface, u.alpha).toFixed(2)}:1`);
    expect(failing).toEqual([]);
  });

  it("keeps every solid foreground token at WCAG AA (4.5:1)", () => {
    const failing = FOREGROUNDS.filter((name) => contrast(hslToRgb(token(name)), surface, 1) < 4.5);
    expect(failing).toEqual([]);
  });
});
