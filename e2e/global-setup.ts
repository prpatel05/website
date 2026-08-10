import { BUILD_STAMP_FILE, readBuildStamp } from "../scripts/build-stamp.mjs";
import { PORT_ENV_VAR, previewBaseURL } from "../scripts/preview-port.mjs";

/**
 * Refuses to run the suite against a server that is not serving this build.
 *
 * `webServer` is a Playwright plugin, and plugin setup runs before this hook —
 * so by the time we get here the server has either been started or, with
 * `reuseExistingServer` on, adopted from whatever was already listening. That
 * adoption is decided on "the URL responded" and nothing else, which is how a
 * full suite came to be graded against another worktree's `dist/`: 18 failures
 * that were entirely fictional, and, in the direction that actually costs you,
 * a broken build that a stale server would have reported clean (PRA-836).
 *
 * Comparing the stamp the server hands back with the stamp on disk settles it
 * before a single test runs. Cheap enough to do on every run, including the one
 * where Playwright started the server itself and the answer is never in doubt —
 * a check that only runs in the risky case is a check nobody trusts.
 */

const FETCH_TIMEOUT_MS = 10_000;

function fail(problem: string, remedy: string): never {
  throw new Error(
    `\n${problem}\n\n${remedy}\n\n` +
      `Set ${PORT_ENV_VAR} to move this run to a different port.\n`
  );
}

export default async function globalSetup() {
  const baseURL = previewBaseURL();
  const stampURL = `${baseURL}/${BUILD_STAMP_FILE}`;

  const local = readBuildStamp();
  if (!local) {
    fail(
      `No build stamp in dist/ — the e2e suite cannot tell which build is under test.`,
      `Run \`npm run build\` and try again.`
    );
  }

  // `vite preview` answers 200 with the SPA shell for any path it cannot find,
  // so a successful response is not evidence the stamp exists. Only a parsed
  // body carrying an id counts, which is also what rules out a server whose
  // dist/ predates the stamp entirely.
  let servedStamp: { id?: string; builtAt?: string };
  try {
    const response = await fetch(stampURL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text();
    const parsed = JSON.parse(body);
    if (typeof parsed?.id !== "string") throw new Error("no id in the response");
    servedStamp = parsed;
  } catch (error) {
    fail(
      `Could not read a build stamp from ${stampURL} (${(error as Error).message}).`,
      `Whatever is answering on ${baseURL} is not a \`vite preview\` of a ` +
        `current build of this project — an unrelated server, or one serving a ` +
        `dist/ built before the stamp existed. Stop it, or move this run to a ` +
        `free port.`
    );
  }

  if (servedStamp.id !== local.id) {
    fail(
      `${baseURL} is serving a different build than the dist/ under test.\n` +
        `  dist/ on disk: ${local.id} (built ${local.builtAt})\n` +
        `  server says:   ${servedStamp.id} (built ${servedStamp.builtAt})`,
      `Playwright reused a preview server it did not start, so every result in ` +
        `this run would have described someone else's build. Stop whatever holds ` +
        `${baseURL}, or move this run to a free port.`
    );
  }
}
