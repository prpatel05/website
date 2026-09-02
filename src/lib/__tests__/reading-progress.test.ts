import { describe, expect, it } from "vitest";
import { readingProgress } from "../reading-progress";

describe("readingProgress", () => {
  it("is 0 before the article has reached the top of the viewport", () => {
    expect(readingProgress(200, 2000, 0, 800)).toBe(0);
  });

  it("is 0 when the article top is exactly at the viewport top", () => {
    expect(readingProgress(200, 2000, 200, 800)).toBe(0);
  });

  it("is 100 when the article bottom meets the viewport bottom", () => {
    expect(readingProgress(200, 2000, 1400, 800)).toBe(100);
  });

  it("is 50 halfway through the remaining travel", () => {
    expect(readingProgress(200, 2000, 800, 800)).toBe(50);
  });

  it("clamps above 100 after the end", () => {
    expect(readingProgress(200, 2000, 4000, 800)).toBe(100);
  });

  it("is 100 for a fully-visible short article once its top is reached", () => {
    expect(readingProgress(100, 400, 100, 800)).toBe(100);
  });

  it("is 0 for a short article that has not reached the top yet", () => {
    expect(readingProgress(100, 400, 0, 800)).toBe(0);
  });
});
