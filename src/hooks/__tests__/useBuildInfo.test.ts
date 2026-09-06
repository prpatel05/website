import { describe, expect, it } from "vitest";
import { parseShaCandidate } from "../useBuildInfo";

describe("parseShaCandidate", () => {
  it("accepts a full git SHA", () => {
    expect(parseShaCandidate("058efc4d321f986ceda3059ce1e7b1ced9d251b7")).toBe(
      "058efc4",
    );
  });

  it("accepts a UUID stamp id", () => {
    expect(parseShaCandidate("75f3b992-d7b7-499e-a1fa-76bb1409b88b")).toBe(
      "75f3b99",
    );
  });

  it("rejects SPA HTML fallbacks", () => {
    expect(parseShaCandidate("<!DOCTYPE html><html></html>")).toBe("");
    expect(parseShaCandidate("  <!doctype html>")).toBe("");
  });

  it("rejects empty and non-hex junk", () => {
    expect(parseShaCandidate("")).toBe("");
    expect(parseShaCandidate("local")).toBe("");
    expect(parseShaCandidate("abc")).toBe("");
  });
});
