/**
 * Generate public/resume.pdf from src/data/resume.ts content.
 * Print-friendly, single-column, ATS-friendly layout (no site chrome).
 * Target: clean Letter PDF at exactly two pages (experience continues onto
 * page 2; skills / education / publications land there intentionally).
 *
 *   bun scripts/generate-resume-pdf.mjs
 */
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import {
  education,
  executiveSummary,
  experience,
  publications,
  resumeMeta,
  skillGroups,
} from "../src/data/resume.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, "../public/resume.pdf");
const tmpHtml = resolve(tmpdir(), `resume-print-${process.pid}.html`);

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Keep hyphenated identifiers intact so ATS paste does not glue "@boundedsh/client". */
function escKeep(s) {
  let out = esc(s);
  for (const token of ["@bounded-sh/client", "policy-enforced", "policy.json", "bounded.page"]) {
    out = out.replaceAll(token, `<span class="nb">${token}</span>`);
  }
  return out;
}

const contactLine = [
  esc(resumeMeta.location),
  esc(resumeMeta.phone),
  esc(resumeMeta.email),
].join(" | ");

const linksLine = resumeMeta.links.map((l) => esc(l.label)).join(" | ");

const rolesHtml = experience
  .map((role) => {
    const links =
      role.orgLinks && role.orgLinks.length
        ? `<div class="org-links">${role.orgLinks
            .map((l) => esc(l.label))
            .join(" | ")}</div>`
        : "";
    const bullets = role.bullets
      .map((b) => `<li>${escKeep(b)}</li>`)
      .join("\n");
    return `
    <section class="role">
      <div class="role-head">
        <div>
          <h3>${esc(role.title)}</h3>
          <div class="org">${esc(role.org)}</div>
          ${links}
        </div>
        <div class="dates">${esc(role.dates)}</div>
      </div>
      <p class="blurb">${escKeep(role.blurb)}</p>
      <ul>${bullets}</ul>
    </section>`;
  })
  .join("\n");

const skillsHtml = skillGroups
  .map(
    (g) =>
      `<div class="skill"><span class="label">${esc(g.label)}:</span> ${esc(
        g.items
      )}</div>`
  )
  .join("\n");

const pubsHtml = publications
  .map(
    (p) =>
      `<li><strong>${esc(p.title)}</strong> - ${esc(p.text)}</li>`
  )
  .join("\n");

const summaryHtml = executiveSummary.map((p) => `<p>${escKeep(p)}</p>`).join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(resumeMeta.name)} - Resume</title>
  <style>
    @page { size: Letter; margin: 0.5in; }
    * { box-sizing: border-box; }
    body {
      font-family: Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.32;
      color: #111;
      margin: 0;
      hyphens: none;
      -webkit-hyphens: none;
    }
    .nb { white-space: nowrap; }
    h1 {
      font-size: 17pt;
      letter-spacing: 0.04em;
      text-align: center;
      margin: 0 0 2px;
      font-weight: 700;
    }
    .headline {
      text-align: center;
      font-size: 9.5pt;
      font-weight: 600;
      margin: 0 0 2px;
    }
    .meta, .links {
      text-align: center;
      font-size: 8.5pt;
      color: #333;
      margin: 0 0 1px;
    }
    h2 {
      font-size: 10.5pt;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      border-bottom: 1px solid #222;
      padding-bottom: 2px;
      margin: 11px 0 6px;
      font-weight: 700;
    }
    .summary p { margin: 0 0 3px; }
    .skills { margin: 0 0 2px; }
    .skill { margin: 0 0 10px; }
    .skill .label { font-weight: 700; }
    /* Allow long roles to continue across pages so both Letter pages fill. */
    .role { margin: 0 0 7px; break-inside: auto; page-break-inside: auto; }
    .role-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: baseline;
      break-after: avoid;
      page-break-after: avoid;
    }
    .role h3 {
      font-size: 10pt;
      margin: 0;
      font-weight: 700;
    }
    .role .org {
      font-size: 9.25pt;
      font-weight: 600;
      color: #222;
      margin-top: 0;
    }
    .dates {
      white-space: nowrap;
      font-size: 8.5pt;
      font-weight: 600;
      color: #222;
    }
    .org-links { font-size: 8pt; color: #333; margin-top: 0; break-after: avoid; page-break-after: avoid; }
    .blurb {
      font-style: italic;
      color: #333;
      margin: 1px 0 2px;
      font-size: 8.75pt;
      break-after: avoid;
      page-break-after: avoid;
    }
    ul {
      margin: 0;
      padding-left: 15px;
      list-style-type: disc;
    }
    li { margin: 0 0 2.5px; }
    .edu { margin: 0 0 12px; }
    .edu strong { font-weight: 700; }
    .edu .school { color: #222; }
    .edu div + div { margin-top: 1px; }
  </style>
</head>
<body>
  <header>
    <h1>${esc(resumeMeta.name).toUpperCase()}</h1>
    <p class="headline">${esc(resumeMeta.headline)}</p>
    <p class="meta">${contactLine}</p>
    <p class="links">${linksLine}</p>
  </header>

  <h2>Summary</h2>
  <div class="summary">${summaryHtml}</div>

  <h2>Experience</h2>
  ${rolesHtml}

  <h2>Skills</h2>
  <div class="skills">${skillsHtml}</div>

  <h2>Education</h2>
  <div class="edu">
    <div><strong>${esc(education.degree)}</strong> | <span class="school">${esc(
      education.school
    )}</span></div>
    <div>${esc(education.notes)}</div>
  </div>

  <h2>Publications</h2>
  <ul>${pubsHtml}</ul>
</body>
</html>`;

writeFileSync(tmpHtml, html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${tmpHtml}`, { waitUntil: "networkidle" });
await page.pdf({
  path: outPath,
  format: "Letter",
  printBackground: true,
  margin: { top: "0.5in", bottom: "0.5in", left: "0.5in", right: "0.5in" },
});
await browser.close();
rmSync(tmpHtml, { force: true });
console.log(`wrote ${outPath}`);
