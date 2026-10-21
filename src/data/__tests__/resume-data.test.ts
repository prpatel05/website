import { describe, expect, it } from "vitest";
import * as resume from "../resume";

const allText = JSON.stringify(resume);

/**
 * Guards from the Oct 2026 resume audit. Workday invented phantom roles from
 * notes packed into a date field and from two employers on one entry, so each
 * entry keeps one employer, one title line, and one date range.
 */
describe("resume data", () => {
  it("keeps each date field to a single range", () => {
    for (const role of resume.experience) {
      expect(role.dates).not.toMatch(/[()]/);
      expect(role.dates.split(" - ")).toHaveLength(2);
    }
  });

  it("lists one employer per entry", () => {
    for (const role of resume.experience) {
      expect(role.org).not.toMatch(/\||\bvia\b|\(/);
    }
  });

  it("ships no placeholders, em dashes, or scrubbed phrasing", () => {
    expect(allText).not.toMatch(/\u2014|\u2013/);
    expect(allText).not.toMatch(/confirm|\[X|TODO/i);
    expect(allText).not.toMatch(/11\+ years/);
    expect(allText).not.toMatch(/Medalist/);
    expect(allText).not.toMatch(/overlap|part-time|alongside AWS/i);
  });

  it("never credits a founder role at eddii", () => {
    // Co-founder credit belongs to Zay Codes only. eddii was a CTO role.
    expect(allText).not.toMatch(/founding CTO/i);
    expect(allText).not.toMatch(/found\w*[^.;"]{0,60}eddii|eddii[^.;"]{0,60}found/i);
    const eddii = resume.experience.find((r) => r.org === "eddii");
    expect(eddii).toBeDefined();
    expect(JSON.stringify(eddii)).not.toMatch(/found/i);
    expect(resume.resumeMeta.headline).toMatch(/Co-Founder,? (of )?Zay Codes/);
    const zay = resume.experience.find((r) => r.org === "Zay Codes");
    expect(zay?.title).toMatch(/Co-Founder/);
  });
});
