import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
  PORT_ENV_VAR,
  previewBaseURL,
  previewPort,
} from "../../../scripts/preview-port.mjs";
import {
  BUILD_STAMP_FILE,
  readBuildStamp,
  writeBuildStamp,
} from "../../../scripts/build-stamp.mjs";

// Together these two modules are what stops the e2e suite grading a build it is
// not looking at (PRA-836). The failure they prevent is silent in both
// directions — a stranger's server produced 18 fictional failures, and the same
// mechanism can just as easily report a broken build clean — so the properties
// each one rests on are pinned here rather than left to the e2e run, which by
// definition cannot catch the case where it tested the wrong thing.

const tempDirs: string[] = [];

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "preview-isolation-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  delete process.env[PORT_ENV_VAR];
  while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe("preview port derivation", () => {
  it("gives one worktree the same port every run, so a rerun can reuse its server", () => {
    const worktree = "/Users/dev/workspaces/alpha/site";
    expect(previewPort(worktree)).toBe(previewPort(worktree));
  });

  it("gives concurrent worktrees different ports", () => {
    // The whole premise: two agents serving this site side by side must not
    // land on one port. Sampled broadly rather than on two hand-picked paths,
    // which could pass on a hash that ignored most of its input.
    const ports = new Set(
      Array.from({ length: 200 }, (_, i) =>
        previewPort(`/Users/dev/workspaces/${i}/site`)
      )
    );
    expect(ports.size).toBeGreaterThan(150);
  });

  it("stays below the range an OS allocates ephemeral ports from", () => {
    // Linux hands out 32768+ and macOS 49152+. A derived port inside either
    // window could be given to an unrelated process between runs.
    for (let i = 0; i < 500; i++) {
      const port = previewPort(`/Users/dev/workspaces/${i}/site`);
      expect(port).toBeGreaterThanOrEqual(4200);
      expect(port).toBeLessThan(4800);
    }
  });

  it("honours the override, which is the escape hatch the failure message offers", () => {
    process.env[PORT_ENV_VAR] = "4999";
    expect(previewPort()).toBe(4999);
    expect(previewBaseURL()).toBe("http://localhost:4999");
  });

  it("rejects an unusable override instead of falling back to a derived port", () => {
    // Silently ignoring it would put the run on a port the developer did not
    // ask for — the same class of surprise this module exists to remove.
    for (const bad of ["", "notaport", "0", "70000", "4173.5"]) {
      process.env[PORT_ENV_VAR] = bad;
      if (bad === "") {
        expect(previewPort("/Users/dev/site")).toBeGreaterThanOrEqual(4200);
      } else {
        expect(() => previewPort()).toThrow(PORT_ENV_VAR);
      }
    }
  });
});

describe("build stamp", () => {
  it("round-trips, and tags each build distinctly", () => {
    const a = tempDir();
    const b = tempDir();

    const first = writeBuildStamp(a);
    const second = writeBuildStamp(b);

    expect(readBuildStamp(a)?.id).toBe(first.id);
    expect(readBuildStamp(b)?.id).toBe(second.id);
    expect(first.id).not.toBe(second.id);
  });

  it("carries no filesystem paths, because the file ships with the deploy", () => {
    const dist = tempDir();
    writeBuildStamp(dist);
    const raw = readFileSync(join(dist, BUILD_STAMP_FILE), "utf-8");

    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(["builtAt", "id"]);
    expect(raw).not.toMatch(/\/(Users|home|tmp)\//);
  });

  it("reads as absent rather than throwing when there is no usable stamp", () => {
    // The e2e gate turns a null into "run npm run build". An exception here
    // would surface as a crash with no instruction attached.
    const missing = tempDir();
    expect(readBuildStamp(missing)).toBeNull();

    const corrupt = tempDir();
    writeFileSync(join(corrupt, BUILD_STAMP_FILE), "{ not json", "utf-8");
    expect(readBuildStamp(corrupt)).toBeNull();

    const idless = tempDir();
    writeFileSync(join(idless, BUILD_STAMP_FILE), '{"builtAt":"now"}', "utf-8");
    expect(readBuildStamp(idless)).toBeNull();
  });
});
