import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const app = readFileSync(join("src", "App.tsx"), "utf8");

describe("/vc", () => {
  it("is a real route in the app", () => {
    expect(app).toMatch(/<Route path="\/vc"/);
    expect(app).toMatch(/import VC from/);
  });
});
