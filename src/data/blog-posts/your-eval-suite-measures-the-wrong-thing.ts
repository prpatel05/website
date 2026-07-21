import { BlogPost } from "./types";

export const yourEvalSuiteMeasuresTheWrongThing: BlogPost = {
  slug: "your-eval-suite-measures-the-wrong-thing",
  title: "Your Eval Suite Measures the Wrong Thing",
  subtitle:
    "Nearly a quarter of what goes wrong in multi-agent systems is a verification failure. The most common one is a check that ran, and said yes.",
  date: "2026.08",
  dateISO: "2026-08-11",
  readTime: "8 min",
  tags: ["ai", "agents", "evals", "reliability"],
  image: "/images/blog-your-eval-suite-measures-the-wrong-thing.webp",
  content: `Everyone measures whether the agent works. Almost nobody measures whether they'd know if it stopped.

That distinction used to be academic. It isn't anymore. In LangChain's [State of Agent Engineering](https://www.langchain.com/state-of-agent-engineering) survey, **57.3% of respondents already had agents running in production**, with another 30.4% actively building toward deployment. Whatever you believe about the hype cycle, the deployment happened. The measurement did not keep pace.

I've been reading the [MAST paper](https://arxiv.org/abs/2503.13657) — a failure taxonomy built from 1,642 annotated execution traces across seven multi-agent frameworks — and one number in it reorganized how I think about evals.

Failures sort into three categories. System design issues are the largest. Inter-agent misalignment is second, and [that's the seam I wrote about last week](/blog/the-handoff-is-where-agents-break/). The third category is **task verification, at 23.5% of everything observed**.

Not "the agent was wrong." The process that was supposed to catch the agent being wrong didn't catch it.

Nearly a quarter of observed failures are failures of the checking layer. Which is to say: of the thing you built to tell you about the other failures.

## The Three Ways Checking Fails

The 23.5% breaks into three named modes, and the breakdown is more useful than the total, because each one is a different thing your eval suite isn't doing:

**Incorrect verification — 9.10%.** Something was checked. The check was wrong.

**No or incomplete verification — 8.20%.** Nothing was checked, or only part of it was.

**Premature termination — 6.20%.** The system stopped before the work was actually done.

Sit with the ordering for a second. The **most common** verification failure is not the missing check. It's the check that ran and returned a pass.

That inverts how most teams think about eval coverage. The instinct is that reliability is a coverage problem — we haven't written enough tests yet, we'll get to it. But the largest single bucket here is code that executed, evaluated the output, and concluded it was fine. More coverage of that kind adds more surface for the same failure.

## What a Superficial Check Looks Like

The paper is specific about why verifiers fail, and the answer is unglamorous. From the authors' analysis of the traces:

> "We find that many existing verifiers perform only superficial checks, despite being prompted to perform thorough verification, such as checking if the code compiles or if there are leftover TODO comments."

Their worked example is a ChatDev-generated chess program. It compiles. It passes review. It has runtime bugs, because nothing validated it against the actual rules of chess. The output is unusable, and every check in the pipeline said it was fine.

Read that list of superficial checks again — does it compile, are there leftover TODOs — and ask how much of your own agent eval suite it describes. Did the code parse. Did the JSON validate. Did the response come back non-empty. Did it mention the keyword. These are all real checks. They are all checks on the *shape* of the output rather than its *correctness*, and shape is exactly what a fluent model gets right while getting the substance wrong.

The paper's own conclusion on this is blunt:

> "Current verifier implementations are often insufficient; sole reliance on final-stage, low-level checks is inadequate."

Final-stage and low-level. That's a description of the median eval suite: one assertion, at the end, on the surface of the answer.

## The Part That Should Actually Worry You

Here is the finding that changed my mind about something.

The authors split their traces by outcome — failures observed in runs that *succeeded* versus runs that *failed* — and the split is not uniform. Some failure modes appear almost exclusively in failed runs. Unaware of termination conditions, information withholding: when those show up, the task is usually going down with them.

Verification failures behave differently. Verbatim:

> "In contrast, verification-related failures like 3.2 No or Incomplete Verification and 3.3 Incorrect Verification appear frequently even in successful runs. This suggests that while these systems can complete some tasks, their verification process still contains flaws."

Your broken verifier does not announce itself by breaking the task. It sits inside runs that came out fine.

This is the measured version of something I've argued from instinct before — that [agents fail quietly](/blog/agents-fail-quietly/), in ways that pass the checks you remembered to write. What I hadn't appreciated is that the quiet failure is often *in the checking layer itself*, and that it persists happily through green runs. The successful run and the broken verifier coexist, and one of them is visible to you.

So the green dashboard is not evidence the verification works. It's evidence the task succeeded, which is a different claim, and on this data those two things come apart routinely.

One honesty note: this success/failure split is a smaller, per-system analysis than the 1,642-trace headline, and the rounding in the published rates suggests roughly ten to a dozen successful traces per system. Treat the direction as the finding, not the magnitude.

## What Actually Moved the Number

The paper doesn't stop at taxonomy. The authors ran interventions on ChatDev and measured them, and the verification-flavored one is the strongest result in the paper.

They changed the system's shape so that it terminates **only when a designated agent confirms all reviews are properly satisfied**, with an iteration cutoff to prevent infinite loops. Before, the pipeline ended when it reached the end of the pipeline. After, it ended when an explicit objective check passed.

On a custom 32-task benchmark the authors call ProgramDev-v0, success went from **25.0 to 40.6 points**.

Three caveats, and I want to give them properly because this figure travels badly.

First, those are percentage points off a very low base. You will see this result quoted as "+15.6% improvement," which reads as relative and overstates it. The system went from failing three quarters of the time to failing three fifths of the time.

Second, the benchmark is 32 custom tasks — the paper explicitly distinguishes ProgramDev-v0 from the ProgramDev dataset it discusses elsewhere. On the second benchmark, HumanEval, the identical change moved success from **89.6 to 91.5**. That's under two points, on a benchmark already near ceiling. This is not a general result and shouldn't be sold as one.

Third, the authors themselves decline to oversell it:

> "Even though our interventions are successful in improving the performance of the framework in different tasks, they do not constitute substantial improvements."

I still think it's the most instructive number here, precisely because of how unspectacular it is. The mechanism is what matters: making termination conditional on an explicit objective check, rather than on having reached the end of the workflow. That is a one-line change in what "done" means, and on the benchmark where there was room to move, it moved more than anything else they tried.

## Four Things to Measure Instead

I don't want to end on a checklist, so let me end on the smallest set of questions your current setup probably can't answer.

**Can you make your verifier fail?** Take a known-bad output — genuinely wrong, not malformed — and run it through your eval suite. If it passes, you've measured the thing you needed to measure. Mutation testing is old, unglamorous, and almost nobody applies it to agent evals, which is odd given that 9.10% is the single largest verification failure mode.

**Do you distinguish "finished" from "stopped"?** Premature termination is 6.20% on its own, and it's the mode with no artifact to inspect — there's no wrong answer sitting there, just less right answer than there should have been. If your telemetry records completion but not *why* the loop exited — objective satisfied, step budget exhausted, tool error swallowed — you cannot see this class at all.

**Does anything check the coverage of the check?** No-or-incomplete verification is 8.20%, and "incomplete" is the operative word. A verifier that inspects three of the seven things that had to be true will report success four sevenths of the time it shouldn't.

**Are you looking at the successful runs?** This is the one that follows directly from the split above, and it's the cheapest. Sample runs that passed. Read the traces. Verification flaws live there, and by definition no alert will ever route you to them.

## The Honest Caveat

MAST is a taxonomy paper built on annotated traces, and the annotation is human judgment applied at scale — the authors report strong inter-annotator agreement, but on a small labelled sample that was then extended by an LLM judge. The intervention results are one system, two benchmarks, one of which is 32 tasks. And the LangChain production figure comes from a self-selected community survey — 63% technology industry, roughly half at companies under a hundred people — so read it as "people who build agents" rather than "enterprises."

None of that changes the shape of the argument, because the argument doesn't need the numbers to be precise. It needs them to be the right *kind* of number, and they are: an independent look at what actually goes wrong, which found that the checking layer is a first-class source of failure rather than the neutral instrument everyone treats it as.

Your eval suite is not a measuring device pointed at your agent. It is another component in the system, written with the same care as the rest of it, failing in the same ways, and — unlike everything else you built — there is nothing downstream of it that would notice if it broke.

Everyone measures whether the agent works.

Start measuring whether you'd know if it stopped.`,
};
