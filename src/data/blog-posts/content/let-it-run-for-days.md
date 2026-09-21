I left an agent on a UI bug for three days.

Not a unit test. Not a greenfield feature. A real flow: sign in, hit the broken screen, reproduce, read the trace, propose a fix, open a PR, watch CI, adjust, try again. When I checked back, it had burned through a stack of dead ends, kept a running log of what it tried, and was still inside the product. That is a different category of work than "write me a function."

Most people treat agents as chat with a deadline measured in minutes. The interesting shift is goals measured in days: walk the UX, chase the failure, leave a trail someone can audit. The inversion is simple. Letting it run is not the hard part. Making the run *bounded, reversible, and inspectable* is.

This is the first post in **Ship With Agents**: how I actually build with the stack, not how demos look on stage.

## A Day-Long Goal Is a Product, Not a Prompt

If you paste "fix the onboarding flow" into a chat window and walk away, you did not create a multi-day agent. You created an unsupervised intern with your credentials.

A day-long goal needs the same artifacts you would demand from a human owner:

- **A stop condition.** What does done mean in the product, not in the model's self-report? "CI green on this PR and the repro steps fail to reproduce" beats "looks fixed."
- **A blast radius.** Which accounts, which environments, which write actions are allowed? A UI walker that can click "Delete project" in prod is not ambitious. It is a pager waiting to happen.
- **A log that survives the session.** Tokens expire. Tabs crash. Context windows fill. The run only counts if the next morning you can read what it tried without reconstructing from vibes.

The prompt is the pitch. The product is the harness around it.

## The Loop Is Reproduce, Trace, Fix, Verify

The shape that actually works for multi-day UI work is boring on purpose:

1. **Reproduce** the failure in a real browser path (or a recorded flow), not from a description of the failure.
2. **Trace** with whatever you already trust: network, console, server logs, session replay, agent tool traces.
3. **Fix** in the smallest reversible change that could prove the theory.
4. **Verify** by running the same path again, preferably with the same scripted steps.

Repeat until the stop condition trips or the budget trips.

Chat-only agents collapse this into a single narrative: they summarize, they sound confident, they skip the verify step. Long-running agents that ship are the ones that treat verify as a gate, not a vibe check. If it cannot re-enter the UI and fail the old repro, it is not done. It is drafting.

I use different tools for different parts of that loop (planning vs UI vs long refactor), but the loop itself does not care which logo is on the tab. The contract does.

## What You Must Own Before You Walk Away

Here is the unglamorous checklist I will not skip. It is shorter than a process doc on purpose. If you cannot hold it in your head, you will not enforce it when you are tired.

**Named owner.** Someone (usually me) is on the hook if the agent opens the wrong PR, burns the wrong quota, or "fixes" the wrong symptom. Parallel tabs do not dilute ownership. They multiply it. (That gets its own post later in this series.)

**Environment seams.** Staging vs prod. Test user vs real customer. Read-only explore vs write-enabled fix. The agent should not discover those seams by accident at 2am.

**Budget.** Time, dollars, and tool calls. A three-day run without a spend cap is a blank check. Caps are not pessimism. They are how you sleep.

**Handoff format.** When you return, you should get: repro steps, hypothesis history, current diff, what was ruled out, and the next action. If the agent can only say "still working," you built a status light, not a teammate.

**Kill switch.** One obvious way to stop writes, revoke the session, and leave the repo in a recoverable state. If you cannot describe the kill switch in one sentence, you are not ready to leave it running.

None of this is romantic. All of it is the difference between a demo and prod.

## Days Are Where Quiet Failures Show Up

Short agent sessions hide the failure modes that matter in production systems.

Context rot: by hour six the model is optimizing for the story it already told, not the UI in front of it. A good harness forces fresh repro evidence into the loop on a schedule, not only when the agent feels stuck.

False fixes: the agent "solves" a symptom by changing a copy string, widening a try/catch, or deleting a flaky assertion. Verify-on-the-real-path catches that. Summaries do not.

Scope creep: a three-day goal becomes a rewrite because nothing told it the blast radius. Bounded tickets beat epic novels.

Tool thrash: hopping models mid-run without a handoff note loses the trail. Use the stack as a team (Claude Max, ChatGPT Pro, SuperGrok, Cursor, Antigravity, whatever you actually pay for), but make the handoff inspectable. The next post in this series is about that division of labor. This one is about the clock.

The longer the run, the more the system needs traces, not vibes. If you would not ship a human's three-day effort without a work log, do not ship an agent's.

I have also started treating "overnight" as a deliberate mode, not a side effect. Before bed I ask: can this agent still prove progress with a fresh repro if the chat dies? If the answer is no, the night run is theater. If the answer is yes, I am buying wall-clock time against a defined ticket, which is the whole point.

## Screenshots Beat Status Sentences

When the agent claims the flow works, I want evidence from the path, not a paragraph. A screenshot of the unbroken screen, a trace id, a failing-then-passing repro script: those are the currency. Status sentences are cheap. The longer the run, the more you should distrust cheap proof.

This is also why mobile check-ins help (more on that later in the series). A phone glance at the log and the latest screenshot is often enough to decide "keep going" or "kill it," without sitting down at the full IDE.

## Start Smaller Than Your Ambition

If you have never left an agent overnight, do not start with "rebuild the billing UX."

Start with a single broken path, a staging-only user, a read-mostly explore phase, and a hard stop at a few hours. Require a written hypothesis list. Require verify. Then stretch the clock.

The flex is not that it ran for days. The flex is that you can explain, from the log alone, what it did while you were gone, and reverse anything you do not like.

## The Bottom Line

Letting an agent run for days is easy. Letting it run for days *without becoming a liability* is the actual skill.

A long goal is only shipping when the loop is reproduce-trace-fix-verify, the blast radius is named, and you can kill it, read it, and reverse it when you get back.
