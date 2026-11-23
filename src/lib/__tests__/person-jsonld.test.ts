import { describe, expect, it } from "vitest";
import { socials } from "@/data/socials";
import { personJsonLd, personSameAs } from "../person-jsonld";

describe("person JSON-LD", () => {
  it("lists every public profile the UI already links, including Substack", () => {
    expect(personSameAs).toContain("https://prpatel05.substack.com");
    expect(personSameAs).toEqual(socials.map((s) => s.url));
  });

  it("emits a Person whose sameAs is that list", () => {
    const person = personJsonLd.find((n) => n["@type"] === "Person");
    expect(person?.sameAs).toEqual(personSameAs);
  });

  it("describes the Person without a years count", () => {
    const person = personJsonLd.find((n) => n["@type"] === "Person");
    expect(person?.description).toMatch(/focused on building/);
    expect(String(person?.description)).not.toMatch(/11\+\s*years/i);
  });

  it("keeps homepage Person JSON-LD free of product pitches", () => {
    const person = personJsonLd.find((n) => n["@type"] === "Person");
    expect(person?.jobTitle).toBe("CTO & Chief Architect");
    expect(person).not.toHaveProperty("worksFor");
    const blob = JSON.stringify(person);
    expect(blob).not.toMatch(/OpenApps|Bounded|poof\.new|Tarobase/i);
  });
});
