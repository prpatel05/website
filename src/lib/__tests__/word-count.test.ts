import { describe, expect, it } from "vitest";
import { wordCountFromHtml } from "../word-count";

describe("wordCountFromHtml", () => {
  it("counts words after stripping tags", () => {
    expect(wordCountFromHtml("<p>Hello <strong>world</strong>.</p>")).toBe(2);
  });

  it("returns undefined for empty markup so JSON-LD can omit the field", () => {
    expect(wordCountFromHtml("")).toBeUndefined();
    expect(wordCountFromHtml("<p>  </p>")).toBeUndefined();
  });
});
