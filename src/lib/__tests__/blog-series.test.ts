import { describe, expect, it } from "vitest";
import {
  SERIES_NAME,
  isSeriesMember,
  seriesMembers,
  seriesPosition,
} from "../blog-series";

const post = (
  slug: string,
  tags: string[],
  dateISO = "2026-06-01"
) => ({ slug, title: slug, dateISO, tags });

const members = [
  post("first", ["ai", "agents", "reliability"], "2026-06-30"),
  post("second", ["agents", "reliability", "engineering"], "2026-07-07"),
  post("third", ["ai", "agents", "evals", "reliability"], "2026-08-11"),
];

const outsiders = [
  post("permissions", ["ai", "agents", "security", "product"], "2026-06-23"),
  post("hiring", ["ai", "hiring", "leadership"], "2026-08-18"),
  post("career", ["growth", "engineering"], "2025-02-15"),
];

const posts = [
  members[2],
  outsiders[1],
  members[1],
  outsiders[0],
  members[0],
  outsiders[2],
];

describe("isSeriesMember", () => {
  it("requires both agents and reliability", () => {
    expect(isSeriesMember(post("a", ["agents", "reliability"]))).toBe(true);
    expect(isSeriesMember(post("b", ["ai", "agents", "reliability", "evals"]))).toBe(
      true
    );
    expect(isSeriesMember(post("c", ["agents"]))).toBe(false);
    expect(isSeriesMember(post("d", ["reliability"]))).toBe(false);
    expect(isSeriesMember(post("e", ["ai", "hiring"]))).toBe(false);
  });

  it("does not match a different casing", () => {
    expect(isSeriesMember(post("a", ["Agents", "Reliability"]))).toBe(false);
    expect(isSeriesMember(post("b", ["agents", "Reliability"]))).toBe(false);
  });
});

describe("seriesMembers", () => {
  it("keeps only the tag pair, in oldest-first reading order", () => {
    expect(seriesMembers(posts).map((p) => p.slug)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("breaks a same-day tie on slug so the order is stable", () => {
    const tied = [
      post("zeta", ["agents", "reliability"], "2026-07-01"),
      post("alpha", ["agents", "reliability"], "2026-07-01"),
    ];
    expect(seriesMembers(tied).map((p) => p.slug)).toEqual(["alpha", "zeta"]);
  });

  it("does not invent members from a slug list", () => {
    expect(seriesMembers(outsiders)).toEqual([]);
  });
});

describe("seriesPosition", () => {
  it("returns null for a post that is not in the series", () => {
    expect(seriesPosition(posts, "hiring")).toBeNull();
    expect(seriesPosition(posts, "career")).toBeNull();
    expect(seriesPosition(posts, "permissions")).toBeNull();
    expect(seriesPosition(posts, "missing")).toBeNull();
  });

  it("reports k of n and the series neighbours, not the archive neighbours", () => {
    expect(seriesPosition(posts, "second")).toEqual({
      name: SERIES_NAME,
      current: members[1],
      previous: members[0],
      next: members[2],
      index: 2,
      total: 3,
    });
  });

  it("has no previous on the first member and no next on the last", () => {
    const first = seriesPosition(posts, "first");
    expect(first?.index).toBe(1);
    expect(first?.total).toBe(3);
    expect(first?.previous).toBeUndefined();
    expect(first?.next?.slug).toBe("second");

    const last = seriesPosition(posts, "third");
    expect(last?.index).toBe(3);
    expect(last?.previous?.slug).toBe("second");
    expect(last?.next).toBeUndefined();
  });

  it("picks up a new post that ships with both tags", () => {
    const nextWeek = post("new-one", ["agents", "reliability"], "2026-08-18");
    const grown = seriesPosition([...posts, nextWeek], "new-one");
    expect(grown?.index).toBe(4);
    expect(grown?.total).toBe(4);
    expect(grown?.previous?.slug).toBe("third");
  });
});
