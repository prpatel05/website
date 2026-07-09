import { test, expect } from "./fixtures";
import { isTelemetryRequest } from "../scripts/telemetry-blocklist.mjs";

test.describe("Analytics beacon is never fired from the e2e run", () => {
  /**
   * Deliberately does not depend on `VITE_CF_BEACON_TOKEN` being set. While the
   * token is unset the bundle ships no beacon tag, so asserting "the app fired
   * nothing" would pass for the wrong reason and keep passing after the guard
   * was deleted. Instead, request the beacon host directly and assert the guard
   * refuses it.
   */
  test("the guard aborts requests to the beacon host", async ({
    page,
    blockedTelemetry,
  }) => {
    await page.goto("/");

    const reachedNetwork = await page.evaluate(async () => {
      try {
        await fetch("https://static.cloudflareinsights.com/beacon.min.js", {
          mode: "no-cors",
        });
        return true;
      } catch {
        return false;
      }
    });

    expect(reachedNetwork).toBe(false);
    expect(blockedTelemetry).toContain(
      "https://static.cloudflareinsights.com/beacon.min.js"
    );
  });

  test("no telemetry request completes while browsing the site", async ({
    page,
  }) => {
    const escaped: string[] = [];
    page.on("requestfinished", (request) => {
      if (isTelemetryRequest(request.url())) escaped.push(request.url());
    });

    await page.goto("/");
    await page.goto("/blog");
    await page.waitForLoadState("networkidle");

    expect(escaped).toEqual([]);
  });
});
