import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  PORTRAIT_BLANK,
  PORTRAIT_BLANK_MEDIA,
  PORTRAIT_DIR,
  PORTRAIT_SIZES,
  PORTRAIT_SRC,
  PORTRAIT_SRCSET,
  PORTRAIT_WIDTHS,
} from "../portrait";
import {
  PORTRAIT_DIR as SCRIPT_DIR,
  PORTRAIT_SOURCE,
  PORTRAIT_WIDTHS as SCRIPT_WIDTHS,
  portraitTargets,
  portraitVariants,
} from "../../../scripts/portrait.mjs";

describe("homepage portrait", () => {
  it("names a variant per width, smallest as the default src", () => {
    expect(PORTRAIT_SRC).toBe("/images/portrait/headshot-288w.webp");
    expect(PORTRAIT_SRCSET).toBe(
      "/images/portrait/headshot-288w.webp 288w, " +
        "/images/portrait/headshot-556w.webp 556w"
    );
  });

  it("declares widths in ascending order", () => {
    expect(PORTRAIT_WIDTHS).toEqual([...PORTRAIT_WIDTHS].sort((a, b) => a - b));
  });

  // sharp is told `withoutEnlargement`, so a width above the master's would
  // name a file narrower than its own descriptor and mislead the selection.
  it("asks for nothing wider than the master", () => {
    expect(Math.max(...PORTRAIT_WIDTHS)).toBeLessThanOrEqual(556);
  });

  // The Hero renders in the app bundle and the generator runs in Node, so the
  // derivation exists twice. This is what stops the two from drifting: a width
  // added on one side and not the other points the <img> at a file the build
  // never emitted.
  describe("stays in step with the generator", () => {
    it("agrees on widths and directory", () => {
      expect(PORTRAIT_WIDTHS).toEqual(SCRIPT_WIDTHS);
      expect(PORTRAIT_DIR).toBe(SCRIPT_DIR);
    });

    it("agrees on src and srcSet", () => {
      expect(portraitVariants()).toEqual({
        src: PORTRAIT_SRC,
        srcSet: PORTRAIT_SRCSET,
      });
    });

    // The <img> can request any entry in the srcSet, so the generator has to
    // emit a file for every one of them.
    it("emits every srcSet entry", () => {
      const emitted = portraitTargets().map(
        (target: { publicPath: string }) => target.publicPath
      );

      for (const entry of PORTRAIT_SRCSET.split(", ")) {
        expect(emitted).toContain(entry.split(" ")[0]);
      }
      expect(emitted).toContain(PORTRAIT_SRC);
    });
  });

  // The generator throws on a missing master, which would fail the build
  // rather than ship a portrait-shaped hole. Catching it here names the file.
  it("has its master on disk", () => {
    expect(
      existsSync(join(process.cwd(), "public", PORTRAIT_SOURCE.slice(1)))
    ).toBe(true);
  });

  // The box is 224px from md and 288px from lg; a `sizes` that claimed one
  // width for both would over- or under-fetch on half the desktop range.
  // Neither branch has to describe the sub-md range, because PORTRAIT_BLANK
  // takes it before `sizes` is ever consulted.
  it("describes both box widths", () => {
    expect(PORTRAIT_SIZES).toBe("(min-width: 1024px) 288px, 224px");
  });

  // The wrapper is `hidden md:block` and `display:none` does not cancel an
  // eager fetch, so without this the portrait — the homepage's only image —
  // was downloaded in full by every phone and painted by none. It also picked
  // the *larger* file: `sizes` resolved to 224px, and 224 x DPR 2.75 is 616
  // device px, which selects 556w over 288w.
  describe("the range with no box", () => {
    // Tailwind's md is 768px, so the gate has to stop one pixel below it. Off
    // by one and either the phones keep fetching or the md box goes blank.
    it("stops one pixel below md", () => {
      expect(PORTRAIT_BLANK_MEDIA).toBe("(max-width: 767px)");
    });

    // Inline, or the request this exists to remove just changes target.
    it("is inline, so it costs no request", () => {
      expect(PORTRAIT_BLANK.startsWith("data:image/")).toBe(true);
    });

    // A `<source>` the browser cannot decode falls through to the `<img>`,
    // which would put the full portrait back on every phone.
    it("decodes to a real 1x1 image", () => {
      const [meta, data] = PORTRAIT_BLANK.split(",");
      expect(meta).toBe("data:image/gif;base64");
      const bytes = Buffer.from(data, "base64");
      // GIF header, then width and height as little-endian 16-bit.
      expect(bytes.subarray(0, 3).toString("latin1")).toBe("GIF");
      expect(bytes.readUInt16LE(6)).toBe(1);
      expect(bytes.readUInt16LE(8)).toBe(1);
    });
  });
});
