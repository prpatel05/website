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
});
