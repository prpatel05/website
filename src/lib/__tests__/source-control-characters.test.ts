import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * No source file carries a control character it did not ask for.
 *
 * `e2e/font-glyph-coverage.spec.ts` shipped with a literal U+0000 where a space
 * was meant, as the separator in a Map key. The key was written out twice - once
 * where it is stored, once where it is read back - and only one copy got the
 * stray byte, so the two never matched. Nothing caught it: tsc and eslint both
 * accept a NUL inside a template literal, the character is invisible in a diff
 * and in review, and the read ran only in the branch that reports an offender,
 * which a green suite never enters. It would have surfaced as a TypeError out of
 * the line meant to name the defect, on the one day the check was right.
 *
 * The cause is not carelessness about one file. A control character typed
 * literally is invisible to every tool that would otherwise show it, so the only
 * place to catch it is a byte scan. Sentinels and separators belong in source as
 * escapes, which are ASCII and survive every round trip; this asserts nothing is
 * spelled the other way.
 *
 * Tab, newline and carriage return are excluded because they are ordinary
 * whitespace. Everything else in C0, plus DEL and the C1 block, is not.
 */

const ROOTS = ["src", "e2e", "scripts"];
const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js", ".css", ".md"];

/**
 * Control characters that never legitimately appear literally in our source.
 *
 * A predicate over codepoints rather than a regex on purpose: a character class
 * spelling these out trips eslint's `no-control-regex`, which exists for exactly
 * the mistake being hunted here, and silencing that rule in the one file about
 * control characters would be the wrong trade.
 */
const isForbidden = (code: number) =>
  code <= 0x08 ||
  code === 0x0b ||
  code === 0x0c ||
  (code >= 0x0e && code <= 0x1f) ||
  (code >= 0x7f && code <= 0x9f);

const hex = (code: number) => `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;

/** Every control character in `text`, as `file:line contains U+XXXX`. */
function offendersIn(file: string, text: string) {
  const found: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (!isForbidden(code)) continue;
    found.push(`${file}:${text.slice(0, i).split("\n").length} contains ${hex(code)}`);
  }
  return found;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      out.push(...sourceFiles(path));
    } else if (EXTENSIONS.some((e) => entry.name.endsWith(e))) {
      out.push(path);
    }
  }
  return out;
}

describe("source files", () => {
  const files = ROOTS.flatMap(sourceFiles);

  it("scans a corpus rather than reporting a clean zero over nothing", () => {
    // An empty sweep prints the same passing result as a clean one, so this
    // check is worth exactly as much as the number of files it actually opened.
    expect(files.length).toBeGreaterThan(50);
    expect(files.filter((f) => f.startsWith("e2e/")).length).toBeGreaterThan(10);
  });

  it("sees a control character when one is there", () => {
    // Positive control for the matcher, not just the corpus. Built from a
    // codepoint so this file stays clean of the byte it is looking for.
    const planted = `key${String.fromCharCode(0)}value`;
    expect(offendersIn("planted.ts", planted)).toEqual(["planted.ts:1 contains U+0000"]);
    // Ordinary whitespace is not an offender, or every file would be one.
    expect(offendersIn("ok.ts", "key value\tand\r\na line")).toEqual([]);
  });

  it("spell control characters as escapes, never as the byte itself", () => {
    const offenders = files.flatMap((file) => offendersIn(file, readFileSync(file, "utf8")));

    expect(
      offenders,
      "a literal control character is invisible in a diff, in review and in the editor, so it " +
        "reads as whatever character was meant - a NUL separator that should have been a space " +
        'already shipped once this way. Write it as an escape ("\\u0000", "\\t") instead'
    ).toEqual([]);
  });
});
