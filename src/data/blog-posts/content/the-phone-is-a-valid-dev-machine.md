I unblocked a three-day agent from a phone while waiting for coffee, and the fix was not typing code on glass.

The agent had stalled on a staging-only settings bug. Same loop from [Let It Run for Days](https://pratik.pa.tel/blog/let-it-run-for-days/): reproduce, trace, fix, verify. The log was fine. The stop condition was fine. What it needed was a one-line decision I had been avoiding: empty string is omit, not clear. I approved the smallest reversible patch, kicked verify, and put the phone away. By the time I sat down at the desk, CI was green and Antigravity had already walked the reload path. Twelve minutes of steering. Zero lines typed with my thumbs.

The usual story says a phone is too small for real work. The inversion is quieter. Screen size is not the bottleneck. The seam between pocket and desk is. If your stack only works when you are at a keyboard, you do not have a shipping system. You have a desk ritual. A phone is a valid place to steer agents, review evidence, unblock a stuck loop, and kick the next job, as long as blast radius and contracts travel with you.

This is the third post in **Ship With Agents**. The first was about long runs that stay bounded. The second was about treating [your stack as a team, not a subscription](https://pratik.pa.tel/blog/your-stack-is-a-team-not-a-subscription/). This one is about the control surface you already carry.

## The Desk Myth Is a Latency Tax

Most of us still treat "real work" as a place. Chair, monitor, IDE, full keyboard. Everything else is triage: glance at Slack, approve a deploy you barely read, promise to look when you get back.

That myth costs wall-clock time on agent work. Long loops do not wait politely for your calendar. They stall on a permission prompt, a missing constraint, a wrong environment flag, a verify step that needs a human call. If the only place you can answer is the desk, every stall becomes hours of silent burn or a polite progress bar that means nothing.

I used to protect the myth on purpose. Phone meant notifications. Desk meant judgment. What that actually produced was a queue of agent decisions that aged badly. By the time I sat down, the trail had moved, the hypothesis list was stale, and I spent the first twenty minutes reconstructing context I could have spent in ninety seconds from a log and a screenshot.

The phone is not asking to replace Cursor. It is asking to own the decisions that unblock the seats that already have jobs.

## What the Phone Is Allowed to Own

Borrow the roster idea from the stack post. Give the phone a job card, not vibes.

**Job.** Steer, review, unblock, kick. Read the trail. Approve or reject a bounded next step. Raise or lower blast radius. Start a verify pass. Kill a run that is thrashing. Hand a short contract to the next seat (Claude Max for the overnight loop, Cursor for the PR, Antigravity for the UI walk, SuperGrok for the adversarial punch list).

**Not the job.** Large refactors from glass. Ambiguous product taste passes that need the full surface. Fishing through five tabs because you do not know who owns the phase. Anything that requires inventing a new contract with your thumbs while walking.

**Handoff.** Whatever you decide on the phone must leave an artifact the desk can trust without reconstructing intent: a one-paragraph contract, a link to the log, the stop condition, the blast radius, and the next owner. If you only left a reaction in a chat, you did not hand off. You gestured.

**Owner.** Still you. The phone does not dilute ownership. It shortens the time between a stall and a named decision. Parallel notifications do not create parallel accountability.

When the phone's job is clear, you stop pretending every mobile session is either "full IDE" or "ignore it until later." You get a third mode: control surface.

## The Mechanism: Pocket Contract

The mechanism fits on a note you can actually use with one hand.

Before you leave the desk, or before you start a long run, write a pocket contract the phone can enforce:

1. **Goal in product terms.** Not "keep working on settings." Something like: preserve field X across save and reload on staging for the test user.
2. **Blast radius.** Staging only. Named account. Writes allowed or not. Spend cap. Kill switch in one sentence.
3. **Evidence currency.** What counts as proof on the phone: latest screenshot from the path, trace id, failing-then-passing repro, PR link. Status sentences do not count.
4. **Decision menu.** The three or four calls you are allowed to make away from the desk: continue, tighten blast radius, switch hypothesis, kill, kick verify, request a new brief from ChatGPT Pro.
5. **Return seam.** What must be true when you sit down: branch name, current diff summary, hypothesis history, what was ruled out, next action. If the agent cannot produce that, the phone run was theater.

That is the whole model. Bounded, reversible, inspectable, same as the multi-day loop, compressed for a pocket.

The unglamorous part: you will refuse most phone prompts. A vague "what should I do next" with no evidence is not a decision request. It is an invitation to invent work in a worse interface. Ignore it, or demand the trail first.

Demo energy is answering every ping. Prod energy is answering only the decisions your pocket contract named.

## A Worked Hour: One Stall, One Kick

Here is a concrete run shaped like a real gap in the day, not a stage demo.

The setup (desk, morning): Claude Max owns a multi-hour staging bug on a save-and-reload path. ChatGPT Pro already compressed the brief. SuperGrok punched the "empty string as omit" hole. Cursor is ready to land a small PR. Antigravity will verify on the real UI path. Pocket contract is in the run notes: staging test user only, no prod writes, stop when reload keeps field X, kill switch is revoke the session and close the PR.

Ninety minutes later I am not at a keyboard. The agent pings: verify failed after a "fix" that cleared the field instead of preserving it. Hypothesis list shows it treated empty as clear. Evidence: screenshot of the empty field after reload, plus the PATCH payload.

Phone job, not desk myth:

I open the log, not the IDE. I check blast radius still says staging. I pick from the decision menu: reject the clear-field patch, lock the constraint "empty string means omit," kick the smallest reversible fix, require Antigravity to re-run the same reload script. I send that as a short contract back into the loop. I do not try to edit the component on glass. I do not open five model tabs to re-argue the brief. The stack already has seats. The phone only steers the seam.

When I get to the desk, Cursor has a tiny PR, the trail shows the rejected hypothesis, and Antigravity's evidence matches the stop condition. Desk time goes to reading the diff and merging, not reconstructing the morning.

The hour works because the pocket contract existed before the stall. Without it, the same ping becomes "I'll look when I'm back," and the loop burns another afternoon waiting for a judgment call that never needed a monitor.

## The Seam Is Where Phone Work Breaks

Phone failures look like product failures, but they are usually seam failures.

**Context rot across devices.** You approve something on the phone that the desk agent never sees as a hard constraint. The loop continues with the old brief. Fix: every phone decision becomes a written contract line in the shared trail, not a private thought.

**Evidence downgrade.** You accept a status sentence because reading a trace on a small screen feels annoying. That is how false fixes ship. Fix: if the evidence currency is a screenshot and a payload, do not accept a paragraph.

**Blast radius creep.** A mobile approve feels small, so you widen writes "just this once." Small screens do not make large permissions safe. Fix: the pocket contract names the ceiling. Raising it is a deliberate act, preferably when you are back at the desk.

**Role collapse.** You start using the phone as a fifth interchangeable chat window, pasting the same vague prompt into Claude Max, ChatGPT Pro, and SuperGrok while walking. That recreates the five-tabs problem from the stack post, only worse. Fix: the phone talks to the owner of the current phase, or it writes a brief for the next owner. It does not hold a panel discussion.

**Handoff amnesia.** You sit down and cannot find what you decided. The desk reinvents the morning. Fix: the return seam is part of the contract. If you cannot paste the decision in under a minute, you do not have a handoff. You have a mood.

Quiet failures love mobile. The interface makes skim feel like diligence. Treat the seam like production infrastructure, because for agent work it is.

## Build for the Pocket Before You Need It

If your agents only report in IDE chrome, you trained yourself to be unavailable.

Give every long run a trail you can read on a phone: hypothesis history, current diff summary, latest path evidence, spend, kill switch. Prefer links that open to the decision surface, not walls of logs you will never scroll with a thumb. Prefer contracts that fit in one screen over novels that require a monitor to parse.

You do not need a custom mobile IDE. You need inspectable artifacts and a named decision menu. Claude Max, ChatGPT Pro, SuperGrok, Cursor, Antigravity (or whatever you actually pay for) can keep their jobs. The phone's job is to keep the seams alive when you are not at the desk.

Start smaller than your ambition. Next long run, write the pocket contract before you leave. Answer one real stall from the phone using only the decision menu. Walk back to the desk and check whether the trail still matches what you approved. If it does not, fix the seam, not your typing speed on glass.

The flex is not coding on a phone. The flex is that an agent can keep shipping while you are away from the keyboard, because the control surface in your pocket speaks contracts, not vibes.

## The Bottom Line

A phone is a valid dev machine when it owns steering, review, unblock, and kick, and the desk still owns deep implementation behind a clean seam.

Screen size is not the constraint. An unnamed handoff is. Pocket contracts ship. Desk myths wait.
