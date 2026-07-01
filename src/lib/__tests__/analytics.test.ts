import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initAnalytics } from "../analytics";

const BEACON_SELECTOR = 'script[data-cf-beacon]';

describe("initAnalytics", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    document.body.innerHTML = "";
  });

  it("does not inject the beacon when no token is configured", () => {
    vi.stubEnv("VITE_CF_BEACON_TOKEN", "");
    initAnalytics();
    expect(document.querySelector(BEACON_SELECTOR)).toBeNull();
  });

  it("injects the Cloudflare beacon with the configured token", () => {
    vi.stubEnv("VITE_CF_BEACON_TOKEN", "test-token-123");
    initAnalytics();

    const script = document.querySelector(BEACON_SELECTOR) as HTMLScriptElement;
    expect(script).not.toBeNull();
    expect(script.src).toBe("https://static.cloudflareinsights.com/beacon.min.js");
    expect(script.defer).toBe(true);
    expect(JSON.parse(script.getAttribute("data-cf-beacon") ?? "{}")).toEqual({
      token: "test-token-123",
    });
  });

  it("does not inject the beacon twice", () => {
    vi.stubEnv("VITE_CF_BEACON_TOKEN", "test-token-123");
    initAnalytics();
    initAnalytics();
    expect(document.querySelectorAll(BEACON_SELECTOR)).toHaveLength(1);
  });
});
