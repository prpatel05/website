import { randomUUID } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

/**
 * A per-build identifier written into `dist/`, so the e2e suite can prove the
 * server it is about to test is serving *this* build.
 *
 * A unique port per worktree (`scripts/preview-port.mjs`) stops two workspaces
 * from colliding, but it is a probabilistic fix: nothing guarantees the process
 * answering on that port is the one Playwright meant to talk to. Since
 * `reuseExistingServer` decides purely on "does the URL respond", any responder
 * is accepted. This is the check that closes that gap — `vite preview` serves
 * `dist/` straight off disk, so a stamp fetched from the server and a stamp
 * read from disk agree if and only if they are the same `dist/`.
 *
 * The id is random rather than a hash of the tree because the question is
 * identity, not equality: hashing 5MB of output on every build to answer a
 * question a UUID answers exactly is not a trade worth making.
 *
 * The file ships with the deploy, which is why it carries no filesystem paths —
 * only an opaque id and a timestamp.
 */

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");

/** Served at `/build-stamp.json` by `vite preview` and by the deploy. */
export const BUILD_STAMP_FILE = "build-stamp.json";

export function writeBuildStamp(dist = DIST) {
  const stamp = { id: randomUUID(), builtAt: new Date().toISOString() };
  const path = join(dist, BUILD_STAMP_FILE);
  writeFileSync(path, `${JSON.stringify(stamp, null, 2)}\n`, "utf-8");
  return { ...stamp, path };
}

/** The stamp of the build in `dist/`, or null if there is not one to read. */
export function readBuildStamp(dist = DIST) {
  const path = join(dist, BUILD_STAMP_FILE);
  if (!existsSync(path)) return null;

  try {
    const stamp = JSON.parse(readFileSync(path, "utf-8"));
    return typeof stamp?.id === "string" ? stamp : null;
  } catch {
    return null;
  }
}
