import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const E2E_DIR = join(__dirname, "..", "..", "..", "e2e");

/**
 * The e2e telemetry guard is a Playwright fixture, so it only protects specs
 * that import `test` from `./fixtures`. A spec importing straight from
 * `@playwright/test` gets an unguarded context and silently fires a real
 * pageview per navigation into the live analytics dataset — with no failing
 * test to show for it. Pin the import so that mistake cannot merge.
 */
describe("e2e specs are covered by the telemetry guard", () => {
  const specs = readdirSync(E2E_DIR).filter((f) => f.endsWith(".spec.ts"));

  it("finds the e2e specs at all", () => {
    expect(specs.length).toBeGreaterThan(0);
  });

  it.each(specs)("%s imports test from ./fixtures", (spec) => {
    const source = readFileSync(join(E2E_DIR, spec), "utf-8");

    expect(
      source,
      `${spec} imports from @playwright/test directly, bypassing the telemetry guard in e2e/fixtures.ts`
    ).not.toMatch(/from\s+["']@playwright\/test["']/);

    expect(source).toMatch(/from\s+["']\.\/fixtures["']/);
  });
});
