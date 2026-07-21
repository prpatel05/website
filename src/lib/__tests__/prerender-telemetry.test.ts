import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
// Lives in scripts/, outside the vitest `include` glob, so it is imported here
// rather than tested in place.
import {
  isTelemetryRequest,
  TELEMETRY_HOSTS,
} from "../../../scripts/telemetry-blocklist.mjs";

describe("isTelemetryRequest", () => {
  it("blocks the Cloudflare Web Analytics beacon", () => {
    expect(
      isTelemetryRequest("https://static.cloudflareinsights.com/beacon.min.js")
    ).toBe(true);
  });

  it("blocks the Bounded edge collector", () => {
    expect(
      isTelemetryRequest("https://patel-links.bounded.page/px/blog/ref/t-co")
    ).toBe(true);
  });

  it("allows the local prerender server and its assets", () => {
    expect(isTelemetryRequest("http://127.0.0.1:5173/blog/agents-fail-quietly")).toBe(false);
    expect(isTelemetryRequest("http://127.0.0.1:5173/assets/index-abc123.js")).toBe(false);
  });

  it("matches on exact hostname, not substring", () => {
    // A lookalike host must not be treated as telemetry, and — more importantly
    // — must not be able to masquerade as an allowed host either way.
    expect(isTelemetryRequest("https://cloudflareinsights.com.example.test/x")).toBe(false);
    expect(isTelemetryRequest("https://notcloudflareinsights.com/x")).toBe(false);
  });

  it("treats an unparseable URL as non-telemetry rather than throwing", () => {
    expect(isTelemetryRequest("not a url")).toBe(false);
  });

  /**
   * The blocklist is a denylist, so it silently rots if the beacon URL changes.
   * Drive the assertion off the real source: whatever host `initAnalytics()`
   * loads must be one the prerender build refuses to contact. Without this,
   * swapping the beacon URL would reintroduce build-time synthetic pageviews
   * and nothing would fail.
   */
  it("blocks whatever host analytics.ts actually loads the beacon from", () => {
    const source = readFileSync(
      join(__dirname, "..", "analytics.ts"),
      "utf-8"
    );
    const match = source.match(/https:\/\/[^\s"'`]+/);
    expect(match, "no beacon URL found in analytics.ts").not.toBeNull();

    const beaconUrl = match![0];
    expect(new URL(beaconUrl).hostname).toBeTruthy();
    expect(
      isTelemetryRequest(beaconUrl),
      `analytics.ts loads ${beaconUrl}, which prerender does not block. ` +
        `Add its host to TELEMETRY_HOSTS (${TELEMETRY_HOSTS.join(", ")}).`
    ).toBe(true);
  });
});
