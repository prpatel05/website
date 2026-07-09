import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "child_process";
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

let binDir: string;
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
 */
const GH_SHIM = `#!/usr/bin/env python3
import sys, json, os, base64

argv = sys.argv[1:]
fixture = json.load(open(os.environ["GH_FIXTURE"]))

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
    # repos/{repo}/contents/src/data/blog-posts/{slug}.ts?ref={branch}
    path = argv[1]
    branch = path.split("ref=")[1]
    date_iso = fixture.get("files", {}).get(branch)
    if date_iso is None:
        sys.exit(1)  # missing data file
    body = 'export const post = {\\n  dateISO: "%s",\\n};\\n' % date_iso
    print(json.dumps({"content": base64.b64encode(body.encode()).decode()}))

else:
    sys.stderr.write("unstubbed gh call: %s\\n" % " ".join(argv))
    sys.exit(2)
`;

function writeShim(name: string, body: string) {
  const p = join(binDir, name);
  writeFileSync(p, body, { mode: 0o755 });
}

beforeAll(() => {
  binDir = mkdtempSync(join(tmpdir(), "automerge-bin-"));
  workDir = mkdtempSync(join(tmpdir(), "automerge-work-"));
  mkdirSync(binDir, { recursive: true });
  writeShim("gh", GH_SHIM);
  writeShim("date", DATE_SHIM);
});

afterAll(() => {
  rmSync(binDir, { recursive: true, force: true });
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
};

type Run = {
  status: number;
  stdout: string;
  summary: string;
  merges: string[];
  issues: string[];
  polls: number;
};

let runSeq = 0;

function run(fixture: Fixture, today = TODAY): Run {
  const id = `run-${runSeq++}`;
  const fixturePath = join(workDir, `${id}.json`);
  const actionsPath = join(workDir, `${id}.actions`);
  const summaryPath = join(workDir, `${id}.summary`);
  writeFileSync(fixturePath, JSON.stringify(fixture));
  writeFileSync(actionsPath, "");
  writeFileSync(summaryPath, "");

  let status = 0;
  let stdout = "";
  try {
    stdout = execFileSync("bash", [SCRIPT], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        GITHUB_REPOSITORY: REPO,
        GH_FIXTURE: fixturePath,
        GH_ACTIONS: actionsPath,
        FAKE_TODAY: today,
        AUTOMERGE_TODAY: today,
        AUTOMERGE_MERGEABLE_RETRY_SLEEP: "0",
        GITHUB_STEP_SUMMARY: summaryPath,
      },
    });
  } catch (err) {
    const e = err as { status: number; stdout: string };
    status = e.status;
    stdout = e.stdout ?? "";
  }

  const actions = existsSync(actionsPath)
    ? readFileSync(actionsPath, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Record<string, string>)
    : [];

  return {
    status,
    stdout,
    summary: readFileSync(summaryPath, "utf8"),
    merges: actions.filter((a) => a.merge).map((a) => a.merge),
    issues: actions.filter((a) => a.issue).map((a) => a.issue),
    polls: actions.filter((a) => a.poll).length,
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

  it("merges a PR whose publish date is tomorrow", () => {
    const r = run({ prs: [pr()], files: { [BRANCH]: "2026-07-10" } });
    expect(r.merges).toEqual(["31"]);
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
});
