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

/**
 * The hero's decorative particles are a *background* the copy gets painted on.
 *
 * Everything above checks ink against a surface. These check the surface
 * itself. The particles live on a full-bleed `inset-0 pointer-events-none`
 * layer under the hero's content and drift on infinite loops, so each one
 * becomes the backdrop of whatever text it passes under. A `bg-accent` dot at
 * `opacity-40` did exactly that to the hero subtitle, taking it to 4.11:1 for
 * part of every 4s cycle.
 *
 * This is checked here rather than in the e2e sweep because it is the only
 * layer that can check it *deterministically*. Whether a given particle is
 * behind a given glyph depends on the animation frame and the viewport, so a
 * screenshot test samples one frame at one width and passes on the other half
 * of the loop — `e2e/gradient-contrast.spec.ts` found this defect precisely
 * because it happened to catch a bad frame, and it is not a reliable gate for
 * it. The alphas are static values in source, so the worst case the particle
 * can ever produce is arithmetic, and it holds at every viewport and frame.
 *
 * Scope is that one layer, not `bg-primary` everywhere: the primary CTA is a
 * solid `bg-primary` button and is *supposed* to be, carrying
 * `text-primary-foreground` chosen against it. Nothing paints body text over
 * that. Only this layer has copy painted on top of it without any say in it.
 */
describe("hero ornament contrast", () => {
  const hero = readFileSync("src/components/Hero.tsx", "utf8");

  /** The particle layer: from its own class list to the tag that closes it. */
  const layer = (() => {
    const start = hero.indexOf("pointer-events-none");
    const end = hero.indexOf("\n      </m.div>", start);
    if (start < 0 || end < 0) throw new Error("could not find the hero particle layer in Hero.tsx");
    return hero.slice(start, end);
  })();

  /**
   * `bg-accent` + `opacity-25` and `bg-accent/25` composite identically, so
   * both spellings collapse to one effective alpha. `opacity-[0.15]` is the
   * arbitrary-value form — Tailwind's default scale has no 15.
   */
  const particles = [...layer.matchAll(/className="([^"]*)"/g)]
    .map(([, cls]) => cls)
    .flatMap((cls) => {
      const colour = cls.match(/(?:bg|from)-(primary|accent)(?:\/(\d+))?\b/);
      if (!colour) return [];
      const opacity =
        cls.match(/\bopacity-\[([\d.]+)\]/)?.[1] ?? cls.match(/\bopacity-(\d+)\b/)?.[1];
      const classAlpha = colour[2] ? Number(colour[2]) / 100 : 1;
      const elementAlpha = opacity
        ? opacity.includes(".")
          ? Number(opacity)
          : Number(opacity) / 100
        : 1;
      return [{ cls, name: colour[1], alpha: classAlpha * elementAlpha }];
    });

  // The layer is found by string search, so a refactor that renames or reflows
  // it would leave this matching nothing and passing for free.
  it("finds the particles to check", () => {
    expect(particles.length).toBeGreaterThanOrEqual(4);
  });

  /**
   * Against `--muted-foreground`, the dimmest text on the page and the hero
   * subtitle's own colour — the text that actually got hit. Anything that
   * clears the floor against it clears it against `--foreground` too.
   */
  it("keeps text readable over every hero particle (4.5:1)", () => {
    const background = hslToRgb(token("background"));
    const text = luminance(hslToRgb(token("muted-foreground")));

    const failing = particles
      .map((p) => {
        const composited = hslToRgb(token(p.name)).map(
          (c, i) => c * p.alpha + background[i] * (1 - p.alpha)
        ) as [number, number, number];
        const behind = luminance(composited);
        const ratio = (Math.max(text, behind) + 0.05) / (Math.min(text, behind) + 0.05);
        return { ...p, ratio };
      })
      .filter((p) => p.ratio < 4.5)
      .map((p) => `${p.cls.slice(0, 70)} → ${p.ratio.toFixed(2)}:1 at alpha ${p.alpha}`);

    expect(failing).toEqual([]);
  });
});
