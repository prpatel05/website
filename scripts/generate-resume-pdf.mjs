/**
 * Generate public/resume.pdf from src/data/resume.ts content.
 * Print-friendly, single-column, professional layout (no site chrome).
 *
 *   node scripts/generate-resume-pdf.mjs
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

const contactLine = [
  esc(resumeMeta.location),
  esc(resumeMeta.phone),
  esc(resumeMeta.email),
].join(" · ");

const linksLine = resumeMeta.links.map((l) => esc(l.label)).join(" · ");

const rolesHtml = experience
  .map((role) => {
    const links =
      role.orgLinks && role.orgLinks.length
        ? `<div class="org-links">${role.orgLinks
            .map((l) => esc(l.label))
            .join(" · ")}</div>`
        : "";
    const bullets = role.bullets
      .map((b) => `<li>${esc(b)}</li>`)
      .join("\n");
    return `
    <section class="role">
      <div class="role-head">
        <div>
          <h3>${esc(role.title)} <span class="sep">|</span> ${esc(role.org)}</h3>
          ${links}
        </div>
        <div class="dates">${esc(role.dates)}</div>
      </div>
      <p class="blurb">${esc(role.blurb)}</p>
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
      `<li><strong>${esc(p.title)}</strong> — ${esc(p.text)}</li>`
  )
  .join("\n");

const summaryHtml = executiveSummary.map((p) => `<p>${esc(p)}</p>`).join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(resumeMeta.name)} — Resume</title>
  <style>
    @page { size: Letter; margin: 0.55in 0.6in; }
    * { box-sizing: border-box; }
    body {
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.35;
      color: #111;
      margin: 0;
    }
    h1 {
      font-size: 20pt;
      letter-spacing: 0.04em;
      text-align: center;
      margin: 0 0 4px;
      font-weight: 700;
    }
    .headline {
      text-align: center;
      font-size: 9.5pt;
      font-weight: 600;
      margin: 0 0 4px;
    }
    .meta, .links {
      text-align: center;
      font-size: 8.5pt;
      color: #333;
      margin: 0 0 2px;
    }
    h2 {
      font-size: 10pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border-bottom: 1.25px solid #222;
      padding-bottom: 2px;
      margin: 14px 0 8px;
    }
    .summary p { margin: 0 0 6px; }
    .skill { margin: 0 0 3px; }
    .skill .label { font-weight: 700; }
    .role { margin: 0 0 10px; break-inside: avoid; }
    .role-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: baseline;
    }
    .role h3 {
      font-size: 10pt;
      margin: 0;
      font-weight: 700;
    }
    .role .sep { font-weight: 400; color: #444; }
    .dates {
      white-space: nowrap;
      font-size: 8.5pt;
      font-weight: 600;
      color: #222;
    }
    .org-links { font-size: 8pt; color: #333; margin-top: 1px; }
    .blurb {
      font-style: italic;
      color: #333;
      margin: 2px 0 4px;
      font-size: 8.75pt;
    }
    ul {
      margin: 0;
      padding-left: 16px;
    }
    li { margin: 0 0 3px; }
    .edu strong { font-weight: 700; }
    .edu .school { color: #222; }
  </style>
</head>
<body>
  <header>
    <h1>${esc(resumeMeta.name).toUpperCase()}</h1>
    <p class="headline">${esc(resumeMeta.headline)}</p>
    <p class="meta">${contactLine}</p>
    <p class="links">${linksLine}</p>
  </header>

  <h2>Executive Summary</h2>
  <div class="summary">${summaryHtml}</div>

  <h2>Technical Skills</h2>
  <div class="skills">${skillsHtml}</div>

  <h2>Professional Experience</h2>
  ${rolesHtml}

  <h2>Education</h2>
  <div class="edu">
    <div><strong>${esc(education.degree)}</strong> | <span class="school">${esc(
      education.school
    )}</span></div>
    <div>${esc(education.notes)}</div>
  </div>

  <h2>Publications &amp; Open Source</h2>
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
  margin: { top: "0.55in", bottom: "0.55in", left: "0.6in", right: "0.6in" },
});
await browser.close();
rmSync(tmpHtml, { force: true });
console.log(`wrote ${outPath}`);
