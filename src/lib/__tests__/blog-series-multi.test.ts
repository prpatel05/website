import { describe, expect, it } from "vitest";
import { posts as registryPosts } from "@/data/blog-posts/registry";
import {
  AGENTS_IN_PRODUCTION,
  SERIES,
  SERIES_IDS,
  SHIP_WITH_AGENTS,
  isInSeries,
  isSeriesId,
  isSeriesMember,
  seriesIdOf,
  seriesMembers,
  seriesPosition,
} from "../blog-series";
import type { SeriesId } from "@/data/blog-posts/types";
import { TAG_SERIES_IDS, discoverPosts, discoverSeriesHubIds } from "../../../scripts/blog-posts.mjs";

type P = {
  slug: string;
  title: string;
  dateISO: string;
  tags: string[];
  series?: SeriesId;
};

const post = (
  slug: string,
  tags: string[],
  dateISO: string,
  series?: SeriesId
): P => ({ slug, title: slug, dateISO, tags, ...(series ? { series } : {}) });

const fixture: P[] = [
  post("undo", ["ai", "agents", "reliability"], "2026-07-07"),
  post("demos", ["ai", "agents", "reliability", "evals"], "2026-11-03"),
  post("run-for-days", ["ai", "agents", "shipping"], "2026-09-22", "ship-with-agents"),
  post("model", ["ai", "agents", "tools"], "2026-10-13", "ship-with-agents"),
  // Tagged exactly like the reliability arc; the explicit field wins.
  post("retry", ["ai", "agents", "reliability", "engineering"], "2026-11-24", "agents-in-production"),
  post("stuck", ["ai", "agents", "reliability"], "2026-12-01", "agents-in-production"),
  post("hiring", ["ai", "hiring"], "2026-08-18"),
];

describe("series definitions", () => {
  it("every hub lives under /blog/series/<id>/ with a trailing slash", () => {
    for (const s of SERIES) {
      expect(s.path).toBe(`/blog/series/${s.id}`);
      expect(s.href).toBe(`/blog/series/${s.id}/`);
    }
    expect(SHIP_WITH_AGENTS.href).toBe("/blog/series/ship-with-agents/");
    expect(AGENTS_IN_PRODUCTION.href).toBe("/blog/series/agents-in-production/");
  });

  it("keeps hub copy free of em and en dashes", () => {
    for (const s of SERIES) {
      expect(s.description, s.id).not.toMatch(/[\u2013\u2014]/);
      expect(s.name, s.id).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it("node scripts agree on which series are tag-derived", () => {
    expect(TAG_SERIES_IDS).toEqual(SERIES.filter((s) => s.tags).map((s) => s.id));
  });
});

describe("explicit membership", () => {
  it("an explicit series wins over the reliability tag pair", () => {
    expect(seriesIdOf(fixture[4])).toBe("agents-in-production");
    expect(isSeriesMember(fixture[4])).toBe(false);
    expect(seriesMembers(fixture).map((p) => p.slug)).toEqual(["undo", "demos"]);
  });

  it("explicit members walk their own series in dateISO order", () => {
    expect(seriesMembers(fixture, "agents-in-production").map((p) => p.slug)).toEqual([
      "retry",
      "stuck",
    ]);
    const retry = seriesPosition(fixture, "retry");
    expect(retry).toMatchObject({
      id: "agents-in-production",
      name: "Agents in Production",
      href: "/blog/series/agents-in-production/",
      index: 1,
      total: 2,
    });
    expect(retry?.previous).toBeUndefined();
    expect(retry?.next?.slug).toBe("stuck");
  });

  it("a post without tags in common still joins by field", () => {
    expect(isInSeries(fixture[2], "ship-with-agents")).toBe(true);
    expect(seriesPosition(fixture, "model")).toMatchObject({
      name: "Ship With Agents",
      index: 2,
      total: 2,
    });
  });

  it("filter-safe: isSeriesMember ignores the index argument", () => {
    expect(fixture.filter(isSeriesMember).map((p) => p.slug)).toEqual(["undo", "demos"]);
  });

  it("a post outside every series gets no rail", () => {
    expect(seriesPosition(fixture, "hiring")).toBeNull();
  });
});

describe("the live registry", () => {
  it("every explicit series field names a known series", () => {
    for (const p of registryPosts) {
      if (p.series !== undefined) expect(isSeriesId(p.series), p.slug).toBe(true);
    }
    for (const p of discoverPosts()) {
      if (p.series !== undefined) expect(SERIES_IDS, p.slug).toContain(p.series);
    }
  });

  it("Ship With Agents is the five-post editorial slate, 1 of 5 through 5 of 5", () => {
    const slate = [
      "let-it-run-for-days",
      "your-stack-is-a-team-not-a-subscription",
      "the-phone-is-a-valid-dev-machine",
      "pick-the-model-for-the-job",
      "parallel-agents-need-ownership-too",
    ];
    expect(seriesMembers(registryPosts, "ship-with-agents").map((p) => p.slug)).toEqual(slate);
    slate.forEach((slug, i) => {
      expect(seriesPosition(registryPosts, slug)).toMatchObject({
        id: "ship-with-agents",
        href: "/blog/series/ship-with-agents/",
        index: i + 1,
        total: 5,
      });
    });
  });

  it("Half the Demos Are Fake Now stays in Agent reliability", () => {
    const demos = registryPosts.find((p) => p.slug === "half-the-demos-are-fake-now");
    expect(demos).toBeDefined();
    expect(seriesIdOf(demos!)).toBe("agent-reliability");
  });

  it("A Retry Is Not a Replay, once present, is in Agents in Production only", () => {
    const retry = registryPosts.find((p) => p.slug === "a-retry-is-not-a-replay");
    // Lives on PR #241 until it merges; nothing to assert on main before then.
    if (!retry) return;
    expect(seriesIdOf(retry)).toBe("agents-in-production");
    expect(seriesMembers(registryPosts).map((p) => p.slug)).not.toContain(
      "a-retry-is-not-a-replay"
    );
    expect(seriesMembers(registryPosts, "agents-in-production")[0].slug).toBe(
      "a-retry-is-not-a-replay"
    );
  });

  it("prerender writes a hub only for series that have members", () => {
    const hubs = discoverSeriesHubIds();
    for (const s of SERIES) {
      const hasMembers = seriesMembers(registryPosts, s.id).length > 0;
      expect(hubs.includes(s.id), s.id).toBe(hasMembers);
    }
  });
});
