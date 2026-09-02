import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "child_process";
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";

// scripts/submit-indexnow.mjs is the discovery lever for blog posts: Bing pulls
// from IndexNow directly. It runs as the last step of the deploy, AFTER the
// site is already live, and promises two things that are easy to regress:
//
//  1. It never fails the deploy. A non-zero exit turns an already-shipped
//     deploy red, because the workflow step runs under `bash -e`.
//  2. It finds the key by its self-validating invariant — public/<key>.txt
//     whose body is exactly <key>. If that drifts (a rename, a trailing edit,
//     a regenerated key), findKey() returns null, the script logs "skipping"
//     and exits 0, and the deploy STAYS GREEN while discovery is silently
//     dead. Nothing else in CI would notice, so it is asserted here.
//
// The script resolves dist/ from its own location, so it is copied into a temp
// repo layout and run for real rather than refactored for testability. Every
// case below returns before the fetch(), so the suite makes no network call.

// jsdom rewrites import.meta.url, so resolve from the vitest root instead.
const ROOT = process.cwd();
const SCRIPT = join(ROOT, "scripts/submit-indexnow.mjs");
const KEY = "d4c5b82b618b3d9948f0c09911d77935";

let workDir: string;

function run() {
  const result = spawnSync("node", ["scripts/submit-indexnow.mjs"], {
    cwd: workDir,
    encoding: "utf-8",
  });
  return { ...result, output: `${result.stdout}${result.stderr}` };
}

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "indexnow-test-"));
  mkdirSync(join(workDir, "scripts"));
  copyFileSync(SCRIPT, join(workDir, "scripts/submit-indexnow.mjs"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("submit-indexnow", () => {
  // Regression: readdirSync throws ENOENT on a missing dist/ instead of
  // returning empty, which exited 1 and would fail the deploy step.
  it("exits 0 when dist/ does not exist", () => {
    const { status, output } = run();

    expect(status).toBe(0);
    expect(output).toContain("skipping");
  });

  it("exits 0 when dist/ holds no key file", () => {
    mkdirSync(join(workDir, "dist"));

    const { status, output } = run();

    expect(status).toBe(0);
    expect(output).toContain("skipping");
  });

  // A hex-named file that is not the key must not be submitted as one: sending
  // a key whose file does not echo it back gets the host rejected by IndexNow.
  it("ignores a hex-named file whose body is not its own name", () => {
    mkdirSync(join(workDir, "dist"));
    writeFileSync(join(workDir, "dist/deadbeef.txt"), "not-the-key");

    const { status, output } = run();

    expect(status).toBe(0);
    expect(output).toContain("skipping");
  });

  it("exits 0 when the key is valid but the sitemap is missing", () => {
    mkdirSync(join(workDir, "dist"));
    writeFileSync(join(workDir, `dist/${KEY}.txt`), KEY);

    const { status, output } = run();

    expect(status).toBe(0);
    expect(output).toContain("sitemap");
  });
});

// Read public/ off disk rather than through the app loader: a Vite transform
// could change what an import returns and quietly make this guard vacuous.
describe("the shipped IndexNow key file", () => {
  const publicDir = join(ROOT, "public");
  const keyFiles = readdirSync(publicDir).filter((name) =>
    /^[0-9a-f]{8,128}\.txt$/i.test(name)
  );

  it("is the only hex-named .txt in public/", () => {
    // Two candidates and findKey() picks whichever the filesystem lists first.
    expect(keyFiles).toHaveLength(1);
  });

  it("has a body exactly equal to its filename stem", () => {
    const name = keyFiles[0];
    const body = readFileSync(join(publicDir, name), "utf-8").trim();

    expect(body).toBe(name.replace(/\.txt$/, ""));
  });

  it("is at least 32 characters, as IndexNow requires", () => {
    expect(keyFiles[0].replace(/\.txt$/, "").length).toBeGreaterThanOrEqual(32);
  });
});
