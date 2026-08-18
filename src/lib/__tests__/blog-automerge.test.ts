import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// scripts/blog-automerge.sh is the routine that publishes queued blog posts on
// their dateISO. Its failure mode is silence: a post that does not merge is a
// post that never appears. These tests drive the real script against stubbed
// `gh` and `date` binaries so every not-merged branch can be asserted on.
//
// `date` is stubbed rather than mocked so the clock is pinned (the script's
// branches are all date-relative) and so the suite runs on BSD date too, which
// has no `-d`.

// jsdom rewrites import.meta.url, so resolve from the vitest root instead.
const SCRIPT = join(process.cwd(), "scripts/blog-automerge.sh");
const REPO = "prpatel05/website";
const TODAY = "2026-07-09";
const TOMORROW = "2026-07-10";

let binDir: string;
let realDateBinDir: string;
let workDir: string;

/** Stub `date`, supporting exactly the invocations the script makes. */
const DATE_SHIM = `#!/usr/bin/env python3
import sys, os, datetime

args = [a for a in sys.argv[1:] if a != "-u"]
spec = None
if args and args[0] == "-d":
    spec, args = args[1], args[2:]
fmt = args[0] if args else "+%F"

def parse(s):
    s = s.strip()
    # bare "tomorrow" is the pre-fix script's form; supporting it keeps the
    # old-vs-new differential honest rather than killing the old script at line 7
    if s == "tomorrow":
        return datetime.date.fromisoformat(os.environ["FAKE_TODAY"]) + datetime.timedelta(days=1)
    for suffix in ("+1 day", "+ 1 day"):
        if s.endswith(suffix):
            return datetime.date.fromisoformat(s[: -len(suffix)].strip()) + datetime.timedelta(days=1)
    return datetime.date.fromisoformat(s)

try:
    d = parse(spec) if spec is not None else datetime.date.fromisoformat(os.environ["FAKE_TODAY"])
except Exception:
    sys.exit(1)  # the script relies on a non-zero exit to reject a bad dateISO

if fmt == "+%s":
    print(int(datetime.datetime(d.year, d.month, d.day, tzinfo=datetime.timezone.utc).timestamp()))
else:
    print(d.isoformat())
`;

/**
 * Stub `gh`. Reads GH_FIXTURE for canned responses and appends every
 * state-changing call to GH_ACTIONS so tests can assert on side effects.
 *
 * fixture.mergeableSequence[pr] lets a PR report UNKNOWN and then settle, which
 * is what GitHub actually does while it builds the test merge commit.
 *
 * fixture.checks[pr] is the check-runs payload for that PR's head commit, or
 * the sentinel "error" (the API call fails) or "malformed" (it returns
 * unparseable bytes). Defaults to a single green `ci` run, so the tests that
 * are about date and conflict logic keep merging without restating CI.
 */
const GH_SHIM = `#!/usr/bin/env python3
import sys, json, os, base64, subprocess

argv = sys.argv[1:]
fixture = json.load(open(os.environ["GH_FIXTURE"]))

GREEN = {"total_count": 1,
         "check_runs": [{"name": "ci", "status": "completed", "conclusion": "success"}]}

def record(action):
    with open(os.environ["GH_ACTIONS"], "a") as fh:
        fh.write(json.dumps(action) + "\\n")

def arg(name):
    return argv[argv.index(name) + 1] if name in argv else None

if argv[:2] == ["pr", "list"]:
    print(json.dumps(fixture["prs"]))

elif argv[:2] == ["pr", "view"]:
    number = argv[2]
    seq = fixture.get("mergeableSequence", {}).get(number)
    if seq:
        # pop through the sequence; the last value sticks
        idx = min(len([a for a in open(os.environ["GH_ACTIONS"]).read().splitlines()
                       if json.loads(a).get("poll") == number]), len(seq) - 1)
        record({"poll": number})
        print(seq[idx])
    else:
        print(next(p["mergeable"] for p in fixture["prs"] if str(p["number"]) == number))

elif argv[:2] == ["pr", "merge"]:
    number = argv[2]
    record({"merge": number})
    if fixture.get("mergeResult", {}).get(number, "ok") != "ok":
        sys.stderr.write("merge failed\\n")
        sys.exit(1)

elif argv[:2] == ["issue", "list"]:
    existing = fixture.get("existingIssues", [])
    search = arg("--search") or ""
    title = search.replace(" in:title", "")
    print(len([t for t in existing if t == title]))

elif argv[:2] == ["issue", "create"]:
    record({"issue": arg("--title"), "body": arg("--body")})

elif argv[0] == "api":
    path = argv[1]

    if "/contents/" in path:
        # repos/{repo}/contents/src/data/blog-posts/{slug}.ts?ref={branch}
        branch = path.split("ref=")[1]
        date_iso = fixture.get("files", {}).get(branch)
        if date_iso is None:
            sys.exit(1)  # missing data file
        body = 'export const post = {\\n  dateISO: "%s",\\n};\\n' % date_iso
        payload = {"content": base64.b64encode(body.encode()).decode()}

    elif "/pulls/" in path:
        # repos/{repo}/pulls/{number} -- the head sha the CI gate then looks up
        payload = {"head": {"sha": "sha-" + path.rstrip("/").split("/")[-1]}}

    elif "/check-runs" in path:
        # repos/{repo}/commits/{sha}/check-runs -- sha encodes the PR number
        number = path.split("/commits/")[1].split("/check-runs")[0].replace("sha-", "")
        record({"checks": number})
        spec = fixture.get("checks", {}).get(number, GREEN)
        if spec == "error":
            sys.exit(1)
        if spec == "malformed":
            print("{ this is not json")
            sys.exit(0)
        payload = spec

    else:
        sys.stderr.write("unstubbed gh api path: %s\\n" % path)
        sys.exit(2)

    out = json.dumps(payload)
    # Honour --jq with the real jq, so the shim cannot quietly diverge from the
    # filter the script actually passes.
    if "--jq" in argv:
        p = subprocess.run(["jq", "-r", arg("--jq")], input=out,
                           capture_output=True, text=True)
        sys.stdout.write(p.stdout)
        sys.exit(p.returncode)
    print(out)

else:
    sys.stderr.write("unstubbed gh call: %s\\n" % " ".join(argv))
    sys.exit(2)
`;

function writeShim(name: string, body: string, dir = binDir) {
  const p = join(dir, name);
  writeFileSync(p, body, { mode: 0o755 });
}

beforeAll(() => {
  binDir = mkdtempSync(join(tmpdir(), "automerge-bin-"));
  realDateBinDir = mkdtempSync(join(tmpdir(), "automerge-realdate-bin-"));
  workDir = mkdtempSync(join(tmpdir(), "automerge-work-"));
  mkdirSync(binDir, { recursive: true });
  writeShim("gh", GH_SHIM);
  writeShim("date", DATE_SHIM);
  // Same gh stub, no date stub: this PATH lets one test exercise whatever date
  // dialect the host actually has.
  writeShim("gh", GH_SHIM, realDateBinDir);
});

afterAll(() => {
  rmSync(binDir, { recursive: true, force: true });
  rmSync(realDateBinDir, { recursive: true, force: true });
  rmSync(workDir, { recursive: true, force: true });
});

type Fixture = {
  prs: Array<{
    number: number;
    title: string;
    headRefName: string;
    isDraft: boolean;
    mergeable: string;
  }>;
  files?: Record<string, string>;
  mergeableSequence?: Record<string, string[]>;
  mergeResult?: Record<string, string>;
  existingIssues?: string[];
  checks?: Record<string, unknown>;
};

type Run = {
  status: number;
  stdout: string;
  stderr: string;
  summary: string;
  merges: string[];
  issues: string[];
  polls: number;
  checkCalls: string[];
};

let runSeq = 0;

function run(
  fixture: Fixture,
  today = TODAY,
  bin = () => binDir,
  extraEnv: Record<string, string> = {},
): Run {
  const id = `run-${runSeq++}`;
  const fixturePath = join(workDir, `${id}.json`);
  const actionsPath = join(workDir, `${id}.actions`);
  const summaryPath = join(workDir, `${id}.summary`);
  writeFileSync(fixturePath, JSON.stringify(fixture));
  writeFileSync(actionsPath, "");
  writeFileSync(summaryPath, "");

  // spawnSync rather than execFileSync: the CI gate's diagnostics go to stderr
  // (stdout carries the verdict and must stay parseable), and execFileSync only
  // surfaces stderr on a throw -- which would make the diagnostic assertable
  // only on runs that happen to exit non-zero.
  const proc = spawnSync("bash", [SCRIPT], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin()}:${process.env.PATH}`,
      GITHUB_REPOSITORY: REPO,
      GH_FIXTURE: fixturePath,
      GH_ACTIONS: actionsPath,
      FAKE_TODAY: today,
      AUTOMERGE_TODAY: today,
      AUTOMERGE_MERGEABLE_RETRY_SLEEP: "0",
      GITHUB_STEP_SUMMARY: summaryPath,
      ...extraEnv,
    },
  });
  const status = proc.status ?? 0;
  const stdout = proc.stdout ?? "";
  const stderr = proc.stderr ?? "";

  const actions = existsSync(actionsPath)
    ? readFileSync(actionsPath, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Record<string, string>)
    : [];

  return {
    status,
    stdout,
    stderr,
    summary: readFileSync(summaryPath, "utf8"),
    merges: actions.filter((a) => a.merge).map((a) => a.merge),
    issues: actions.filter((a) => a.issue).map((a) => a.issue),
    polls: actions.filter((a) => a.poll).length,
    checkCalls: actions.filter((a) => a.checks).map((a) => a.checks),
  };
}

const pr = (over: Partial<Fixture["prs"][0]> = {}) => ({
  number: 31,
  title: "Blog: Teach Your Agent to Ask for Help",
  headRefName: "blog/teach-your-agent-to-ask-for-help",
  isDraft: false,
  mergeable: "MERGEABLE",
  ...over,
});

const BRANCH = "blog/teach-your-agent-to-ask-for-help";

describe("blog auto-merge routine", () => {
  it("merges a PR whose publish date is today", () => {
    const r = run({ prs: [pr()], files: { [BRANCH]: TODAY } });
    expect(r.merges).toEqual(["31"]);
    expect(r.status).toBe(0);
  });

  // The routine used to merge a day early, so every post went live the evening
  // before its own dateISO. A post is due on its dateISO and not before.
  it("leaves a PR whose publish date is tomorrow until the morning of", () => {
    const r = run({ prs: [pr()], files: { [BRANCH]: TOMORROW } });
    expect(r.merges).toEqual([]);
    expect(r.stdout).toContain("has not arrived yet");
    expect(r.issues).toEqual([]);
    expect(r.status).toBe(0);
  });

  it("leaves a far-future PR alone and raises no alarm", () => {
    const r = run({ prs: [pr()], files: { [BRANCH]: "2026-07-28" } });
    expect(r.merges).toEqual([]);
    expect(r.issues).toEqual([]);
    expect(r.status).toBe(0);
  });

  it("skips a draft PR without touching it", () => {
    const r = run({ prs: [pr({ isDraft: true })], files: { [BRANCH]: TODAY } });
    expect(r.merges).toEqual([]);
    expect(r.status).toBe(0);
  });

  // GitHub returns UNKNOWN until it has built the test merge commit; any push
  // to main invalidates that for every open PR. The routine used to treat
  // UNKNOWN as "go", attempt the merge, fail, and exit 0 with no issue filed.
  describe("unresolved mergeability", () => {
    it("polls until mergeability settles, then merges", () => {
      const r = run({
        prs: [pr({ mergeable: "UNKNOWN" })],
        files: { [BRANCH]: TODAY },
        mergeableSequence: { "31": ["UNKNOWN", "MERGEABLE"] },
      });
      expect(r.polls).toBeGreaterThan(0);
      expect(r.merges).toEqual(["31"]);
      expect(r.status).toBe(0);
    });

    it("never attempts a merge when mergeability resolves to CONFLICTING", () => {
      const r = run({
        prs: [pr({ mergeable: "UNKNOWN" })],
        files: { [BRANCH]: TODAY },
        mergeableSequence: { "31": ["UNKNOWN", "CONFLICTING"] },
      });
      expect(r.merges).toEqual([]);
      expect(r.issues).toEqual([`Resolve blocked blog merge: ${BRANCH}`]);
      expect(r.status).toBe(1);
    });

    it("files an issue and fails the run when mergeability never resolves", () => {
      const r = run({
        prs: [pr({ mergeable: "UNKNOWN" })],
        files: { [BRANCH]: TODAY },
        mergeableSequence: { "31": ["UNKNOWN"] },
      });
      expect(r.merges).toEqual([]);
      expect(r.stdout).toContain("mergeability unresolved");
      expect(r.issues).toEqual([`Resolve blocked blog merge: ${BRANCH}`]);
      expect(r.status).toBe(1);
    });
  });

  describe("a due post that does not merge is reported, not swallowed", () => {
    it("files an issue and fails the run when the merge command fails", () => {
      const r = run({
        prs: [pr()],
        files: { [BRANCH]: TODAY },
        mergeResult: { "31": "fail" },
      });
      expect(r.merges).toEqual(["31"]);
      expect(r.issues).toEqual([`Resolve blocked blog merge: ${BRANCH}`]);
      expect(r.status).toBe(1);
    });

    // A merge is only ever attempted on a post that is already due, so every
    // failed merge is a real failure -- including on a post being published
    // late, which has already missed its date once.
    it("fails the run when the merge fails on a post being published late", () => {
      const r = run({
        prs: [pr()],
        files: { [BRANCH]: "2026-07-05" },
        mergeResult: { "31": "fail" },
      });
      expect(r.merges).toEqual(["31"]);
      expect(r.issues).toEqual([`Resolve blocked blog merge: ${BRANCH}`]);
      expect(r.status).toBe(1);
    });

    it("files an issue and fails the run when a due PR is CONFLICTING", () => {
      const r = run({
        prs: [pr({ mergeable: "CONFLICTING" })],
        files: { [BRANCH]: TODAY },
      });
      expect(r.merges).toEqual([]);
      expect(r.issues).toEqual([`Resolve blocked blog merge: ${BRANCH}`]);
      expect(r.status).toBe(1);
    });

    it("does not re-file an issue that already exists", () => {
      const r = run({
        prs: [pr({ mergeable: "CONFLICTING" })],
        files: { [BRANCH]: TODAY },
        existingIssues: [`Resolve blocked blog merge: ${BRANCH}`],
      });
      expect(r.issues).toEqual([]);
      expect(r.status).toBe(1);
    });

    it("warns two days ahead of a publish date it cannot meet", () => {
      const r = run({
        prs: [pr({ mergeable: "CONFLICTING" })],
        files: { [BRANCH]: "2026-07-11" },
      });
      expect(r.issues).toEqual([`Resolve blocked blog merge: ${BRANCH}`]);
      // Not yet a missed date, so the run stays green.
      expect(r.status).toBe(0);
    });
  });

  // `main` is unprotected and `ci.yml` only runs `on: pull_request`, so nothing
  // re-checks a commit on its way in. Merging on the publish date also removes
  // the spare day in which a human used to catch a red branch, so this gate is
  // the only thing between a broken post and a live site.
  describe("CI gate", () => {
    const checks = (runs: unknown[]) => ({ total_count: runs.length, check_runs: runs });
    const CHECK = { name: "ci", status: "completed", conclusion: "success" };

    it("merges when every check-run succeeded", () => {
      const r = run({
        prs: [pr()],
        files: { [BRANCH]: TODAY },
        checks: { "31": checks([CHECK]) },
      });
      expect(r.merges).toEqual(["31"]);
      expect(r.stdout).toContain("CI verdict: GREEN");
      expect(r.status).toBe(0);
    });

    it("merges when the commit has no check-runs at all", () => {
      // A repo with no CI configured must not brick the publishing pipeline.
      const r = run({ prs: [pr()], files: { [BRANCH]: TODAY }, checks: { "31": checks([]) } });
      expect(r.merges).toEqual(["31"]);
      expect(r.stdout).toContain("CI verdict: NONE");
      expect(r.status).toBe(0);
    });

    it("counts neutral and skipped conclusions as green", () => {
      const r = run({
        prs: [pr()],
        files: { [BRANCH]: TODAY },
        checks: {
          "31": checks([
            CHECK,
            { name: "optional", status: "completed", conclusion: "neutral" },
            { name: "gated", status: "completed", conclusion: "skipped" },
          ]),
        },
      });
      expect(r.merges).toEqual(["31"]);
      expect(r.status).toBe(0);
    });

    // This is the PRA-1107 class: a post whose own body trips a suite, caught
    // because `ci` runs fresh the moment its PR is opened.
    it.each(["failure", "timed_out", "action_required"])(
      "never merges a post whose CI concluded %s",
      (conclusion) => {
        const r = run({
          prs: [pr()],
          files: { [BRANCH]: TODAY },
          checks: { "31": checks([{ name: "ci", status: "completed", conclusion }]) },
        });
        expect(r.merges).toEqual([]);
        expect(r.stdout).toContain("CI verdict is RED");
        expect(r.issues).toEqual([`Resolve blocked blog merge: ${BRANCH}`]);
        // The publish date has arrived and the post cannot go live: a miss.
        expect(r.status).toBe(1);
      },
    );

    it("never merges while a check-run is still running", () => {
      const r = run({
        prs: [pr()],
        files: { [BRANCH]: TODAY },
        checks: { "31": checks([{ name: "ci", status: "in_progress", conclusion: null }]) },
      });
      expect(r.merges).toEqual([]);
      expect(r.stdout).toContain("CI verdict is PENDING");
      expect(r.issues).toEqual([`Resolve blocked blog merge: ${BRANCH}`]);
      expect(r.status).toBe(1);
    });

    it("treats a failure among still-running checks as red, not pending", () => {
      const r = run({
        prs: [pr()],
        files: { [BRANCH]: TODAY },
        checks: {
          "31": checks([
            { name: "ci", status: "completed", conclusion: "failure" },
            { name: "e2e", status: "in_progress", conclusion: null },
          ]),
        },
      });
      expect(r.stdout).toContain("CI verdict is RED");
      expect(r.merges).toEqual([]);
    });

    // Unknown is unsafe. `cancelled` and `stale` fall outside both sets, the
    // API can fail outright, and a truncated page hides the run that is red.
    it.each([
      ["a conclusion outside both sets", checks([{ name: "ci", status: "completed", conclusion: "cancelled" }])],
      ["an API failure", "error"],
      ["an unparseable payload", "malformed"],
      ["a truncated page", { total_count: 9, check_runs: [CHECK] }],
    ])("never merges on %s", (_label, spec) => {
      const r = run({ prs: [pr()], files: { [BRANCH]: TODAY }, checks: { "31": spec } });
      expect(r.merges).toEqual([]);
      expect(r.stdout).toContain("CI verdict is UNVERIFIED");
      expect(r.issues).toEqual([`Resolve blocked blog merge: ${BRANCH}`]);
      expect(r.status).toBe(1);
    });

    it("does not spend a CI call on a post that is not due yet", () => {
      const r = run({ prs: [pr()], files: { [BRANCH]: "2026-07-28" } });
      expect(r.checkCalls).toEqual([]);
      expect(r.merges).toEqual([]);
      expect(r.status).toBe(0);
    });

    it("gates each due PR independently", () => {
      const second = "blog/trust-comes-from-the-trace";
      const r = run({
        prs: [pr(), pr({ number: 33, headRefName: second })],
        files: { [BRANCH]: TODAY, [second]: TODAY },
        checks: { "31": checks([{ name: "ci", status: "completed", conclusion: "failure" }]) },
      });
      expect(r.checkCalls.sort()).toEqual(["31", "33"]);
      expect(r.merges).toEqual(["33"]);
      expect(r.status).toBe(1);
    });
  });

  describe("past-due posts", () => {
    it("publishes a ready post late rather than stranding it forever", () => {
      const r = run({ prs: [pr()], files: { [BRANCH]: "2026-07-05" } });
      expect(r.merges).toEqual(["31"]);
      expect(r.stdout).toContain("Publishing late");
      expect(r.status).toBe(0);
    });

    it("reports, but never silently publishes, a post past the grace window", () => {
      const r = run({ prs: [pr()], files: { [BRANCH]: "2026-06-01" } });
      expect(r.merges).toEqual([]);
      expect(r.issues).toEqual([`Resolve blocked blog merge: ${BRANCH}`]);
      // Abandoned, not missed: reported once, and the cron does not stay red.
      expect(r.status).toBe(0);
    });
  });

  it("renders the run summary, naming the blocked PR and why", () => {
    const r = run({
      prs: [pr({ mergeable: "CONFLICTING" })],
      files: { [BRANCH]: TODAY },
    });
    expect(r.summary).toContain("### Blocked PRs");
    expect(r.summary).toContain("### Missed publish date");
    expect(r.summary).toContain(`#31 (\`${BRANCH}\`, dateISO: \`${TODAY}\`): merge_conflict`);
    expect(r.stdout).toContain("::error::");
  });

  // Every other test replaces `date` with a python shim, so for months the suite
  // was green on a machine where the real script died at line 8: `date -d` is
  // GNU-only and every agent here runs macOS. This test runs the host's own date.
  it("runs on the host's date, not just the shimmed one", () => {
    const r = run(
      { prs: [pr({ mergeable: "MERGEABLE" })], files: { [BRANCH]: TODAY } },
      TODAY,
      () => realDateBinDir,
    );
    expect(r.stdout).toContain(`UTC date: ${TODAY} (merging posts due on or before ${TODAY})`);
    expect(r.merges).toEqual(["31"]);
    expect(r.status).toBe(0);
  });

  it("keeps going after one PR fails, and reports every failure", () => {
    const second = "blog/trust-comes-from-the-trace";
    const r = run({
      prs: [
        pr({ mergeable: "CONFLICTING" }),
        pr({ number: 33, headRefName: second, mergeable: "MERGEABLE" }),
      ],
      files: { [BRANCH]: TODAY, [second]: TODAY },
    });
    expect(r.merges).toEqual(["33"]);
    expect(r.issues).toContain(`Resolve blocked blog merge: ${BRANCH}`);
    expect(r.status).toBe(1);
  });

  // A dry run is the only way to run this routine without publishing a post,
  // which makes it the only way to check the workflow's token against the real
  // API before a publish date depends on it. Every assertion below is about
  // that: it must read like the real run and write nothing.
  describe("dry run", () => {
    const dry = (fixture: Fixture, today = TODAY) =>
      run(fixture, today, () => binDir, { AUTOMERGE_DRY_RUN: "true" });

    it("merges nothing, and says what it would have merged", () => {
      const r = dry({ prs: [pr()], files: { [BRANCH]: TODAY } });
      expect(r.merges).toEqual([]);
      expect(r.stdout).toContain(`Dry run: would merge #31`);
      expect(r.summary).toContain("**Dry run**");
      expect(r.summary).toContain(`#31 (\`${BRANCH}\`, \`${TODAY}\`)`);
      expect(r.status).toBe(0);
    });

    // The blocked-merge issue is reachable without a merge, so it is the one
    // write a dry run could still perform by accident.
    it("files no blocked-merge issue for a due PR it cannot merge", () => {
      const r = dry({ prs: [pr({ mergeable: "CONFLICTING" })], files: { [BRANCH]: TODAY } });
      expect(r.issues).toEqual([]);
      expect(r.stdout).toContain("Dry run: would create blocked-merge issue");
      // Still red: a dry run that finds a missed publish date reports one.
      expect(r.status).toBe(1);
    });

    // The counterpart to "does not spend a CI call on a post that is not due
    // yet". The real run's thrift is what leaves `checks: read` unexercised on
    // every day but a publish day, so the dry run deliberately pays that cost.
    it("reads the CI gate even when nothing is due, to exercise `checks: read`", () => {
      const r = dry({ prs: [pr()], files: { [BRANCH]: "2026-07-28" } });
      expect(r.checkCalls).toEqual(["31"]);
      expect(r.stdout).toContain("Dry run: not due, but reading the CI gate anyway: GREEN");
      expect(r.merges).toEqual([]);
      expect(r.status).toBe(0);
    });

    // `AUTOMERGE_DRY_RUN: ${{ inputs.dry_run }}` renders to the empty string on
    // the `schedule` event, where there is no `inputs` context. If empty ever
    // counted as dry, the daily cron would silently stop publishing.
    it("treats the empty value the cron passes as a real run", () => {
      const r = run({ prs: [pr()], files: { [BRANCH]: TODAY } }, TODAY, () => binDir, {
        AUTOMERGE_DRY_RUN: "",
      });
      expect(r.merges).toEqual(["31"]);
      expect(r.stdout).not.toContain("DRY RUN");
      expect(r.status).toBe(0);
    });
  });

  // UNVERIFIED is fail-safe but says nothing about which read failed or why, so
  // a wrong `checks: read` scope would stall the queue anonymously.
  it("names the failing CI-gate read on stderr, without polluting the verdict", () => {
    const r = run({ prs: [pr()], files: { [BRANCH]: TODAY }, checks: { "31": "error" } });
    expect(r.stderr).toContain("CI gate: no check-runs for #31");
    expect(r.stdout).toContain("CI verdict is UNVERIFIED");
    expect(r.merges).toEqual([]);
  });
});
