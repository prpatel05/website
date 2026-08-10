import { createHash } from "crypto";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

/**
 * The port `vite preview` binds for the Playwright suite, derived from the
 * worktree it is being run out of.
 *
 * The suite used to hardcode 4173 with `reuseExistingServer` on outside CI, so
 * a preview server another worktree had already started on that port was
 * reused, and the entire run graded that worktree's `dist/` instead of this
 * one's — silently, in both directions. A false failure costs an hour and
 * corrects itself; a stale-but-green server reporting a broken build clean does
 * not (PRA-836).
 *
 * Two agents serving this site from separate worktrees is now routine, so the
 * port has to stop being a shared resource. It is keyed on the worktree path
 * rather than picked free at startup (`listen(0)`, which is what
 * `scripts/prerender.mjs` does) because reuse needs it to be the *same* port on
 * every rerun — that is the fast-local-rerun behaviour `reuseExistingServer`
 * exists for. Hashing gives both: stable per worktree, distinct across them.
 *
 * Collisions with unrelated software are still possible in a 600-port window,
 * which is why the server binds `--strictPort` and the suite verifies the build
 * stamp before testing. Neither can be papered over silently.
 */

// The worktree, not `process.cwd()`: the port must not change depending on
// which directory `playwright test` was invoked from.
const WORKTREE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Below every ephemeral range an OS allocates from (32768+ on Linux, 49152+ on
// macOS), so a derived port cannot be handed to some other process mid-run.
const PORT_MIN = 4200;
const PORT_SPAN = 600;

/** Overrides the derived port, for the case where something else holds it. */
export const PORT_ENV_VAR = "PLAYWRIGHT_PREVIEW_PORT";

export function previewPort(worktree = WORKTREE) {
  const override = process.env[PORT_ENV_VAR];
  if (override !== undefined && override !== "") {
    const parsed = Number(override);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      throw new Error(
        `${PORT_ENV_VAR} must be a port number between 1 and 65535, got "${override}"`
      );
    }
    return parsed;
  }

  const digest = createHash("sha256").update(worktree).digest();
  return PORT_MIN + (digest.readUInt32BE(0) % PORT_SPAN);
}

export function previewBaseURL(worktree = WORKTREE) {
  return `http://localhost:${previewPort(worktree)}`;
}
