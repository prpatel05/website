I kicked off three agents before lunch and came back to four half-finished branches, two overlapping PRs, and nobody who could say which lane owned the stop condition.

One agent was still "fixing" a settings field another had already patched. A third had widened staging writes because its brief never named a ceiling. Spend was fine. Activity looked great. Ownership was a rumor. I spent the afternoon untangling work that had been parallel only in the sense that it collided.

The usual story is that more agents means more throughput. Spin up a second. Spin up a third. Watch the dashboard light up. The inversion is quieter. Parallelism without owners is not speed. It is multiplied blast radius with a progress bar. Tabs do not dilute accountability. They create more places for a quiet failure to hide.

This is the fifth post in **Ship With Agents**, and the last of the locked slate. Earlier posts covered long runs that stay bounded, treating your paid stack as a roster, checking in from a phone, and picking the model for the job. This one is about what happens when several of those loops run at once.

## Two Agents Is Already an Org Chart

One agent is a ticket with a harness. Two agents is a coordination problem, whether you admit it or not.

The second agent does not only double output. It introduces merge conflicts, competing hypotheses, duplicated spend, and the polite fiction that "the system" owns the seam between them. If you cannot name who decides when lane A and lane B disagree, you do not have parallel agents. You have parallel interns sharing a credential.

I used to treat concurrency as a flex: look how many loops I can keep warm. What it actually tested was whether I had written contracts that survive contact with each other. Most days I had not. I had three good prompts and one brain pretending to be a traffic controller after the fact.

The unglamorous truth: every concurrent agent needs the same artifacts you would demand from concurrent humans. A named owner. A lane. A blast radius. A handoff format. A kill switch. If that sounds like process, good. Process is how you keep demo energy from becoming a prod incident with three authors and no defendant.

## Ownership Is a Lane, Not a Feeling

The mechanism fits on a card you can paste into every run brief.

For each concurrent agent, fill five lines before it starts:

1. **Owner.** A human name (usually you). Not "the agent." Not "whichever model is free." Someone who gets the page if this lane writes the wrong thing.
2. **Lane.** One ticket-shaped goal in product terms. Not "help with settings." Something like: preserve field X across save and reload on staging for the test user.
3. **Blast radius.** Environment, account, write ceiling, spend cap. Explicit. Shared credentials without per-lane ceilings are how lane B undoes lane A.
4. **Seam.** What this lane may touch (paths, services, branches) and what it must not. If two lanes share a writable surface, you need a lock, a sequence, or a single owner of that surface.
5. **Done and kill.** Stop condition in the product or the repo, plus one sentence for how you stop writes and leave the tree recoverable.

That card is the whole operating model. Bounded, reversible, inspectable, applied per lane instead of once for the afternoon.

When I say owner, I do not mean the person who clicked Start. I mean the person who will still be accountable when two PRs both claim to fix the same symptom and only one of them verified the path. Parallel agents need ownership too, in the same sense a team does: concurrency without a roster is cosplay.

## A Worked Afternoon: Three Lanes, One Human

Concrete shape, not a stage demo.

The backlog after lunch: (A) the settings save-and-reload bug on staging, (B) a flaky CI check that fails one in five runs on main's cousin branch, (C) a copy pass on an empty-state string that marketing wants today. Tempting to paste all three into one mega-agent. Worse: three agents with the same vague "fix what you can" brief.

Instead, three lane cards.

Lane A (Claude Max overnight-style loop, Cursor for the PR, Antigravity for verify): owner me, staging test user only, branch `fix/settings-x-reload`, stop when scripted reload keeps field X, kill switch revoke session and close PR. SuperGrok already punched empty-string-as-omit on this ticket earlier in the week. That punch list travels in the brief.

Lane B (Cursor-heavy): owner me, CI and test files only, no product string changes, branch `chore/stabilize-settings-check`, stop when the flaky check is green three times in a row on the same commit, spend cap lower than A. It does not get to "improve" the settings UI while it is there.

Lane C (ChatGPT Pro for options, Cursor for the one-line change): owner me, copy file only, no logic, branch `copy/empty-state`, stop when the string matches the approved line and visual check on staging is done by me, not by an unsupervised walker with write access.

Notice the seams. A may touch the settings component and API client. B may touch the test. C may touch the copy file. If A's fix needs a test update, A owns that update or I sequence B after A merges. I do not let B invent a new assertion that papers over A's still-broken path.

Phone check-ins (see **The Phone Is a Valid Dev Machine**) only answer decisions inside each lane's card. I do not let a pocket approve widen B into product code because A looked slow. Model picks stay per seat inside the lane (see **Pick the Model for the Job**). The stack roster still holds (see **Your Stack Is a Team, Not a Subscription**). Parallelism sits on top of those contracts. It does not replace them.

By evening, A has a small PR with path evidence, B has a green flake fix that did not rewrite the feature, and C is merged because it was boring and bounded. Throughput came from isolation, not from wishing three agents would negotiate.

## What Parallel Quietly Breaks

**Hypothesis collisions.** Two agents "solve" the same bug with incompatible stories. Both sound confident. Neither sees the other. Fix: one writable lane per symptom, or a human-owned merge of hypotheses before implementation.

**Branch soup.** Agents push to the same branch or open PRs that both touch `settings.ts`. Git will merge the text. It will not merge the intent. Fix: named branches per lane, and a rule that shared files have a single writer at a time.

**Spend theater.** Three loops burning tokens on the same dead end feels like intensity. It is waste with a fan-out. Fix: per-lane caps, and a shared "ruled out" list that new lanes must read.

**Verify drift.** Lane A fixes path P. Lane B's agent verifies path Q because the brief said "settings" and the model picked a happier screen. Fix: evidence currency names the exact path. Screenshots of the wrong success do not count.

**Ownership fog.** When something ships wrong, the retrospective becomes "the agents." That sentence is how you guarantee a repeat. Fix: the lane card's human name is the retrospective's first line.

Quiet failures love concurrency. Activity hides the missing roster. If you would not run three contractors on one repo without owners and scopes, do not run three agents that way either.

## Sequence Beats Fan-Out When Seams Touch

Not every backlog wants parallelism.

If two tickets share a writable seam, sequence them. Fan-out is for independent blast radii. A copy change and a CI flake can run together. Two theories of the same data-loss bug should not. The skill is saying no to fake parallelism: the dashboard looks busier, the merge is worse, and you still own the mess.

A useful default: one exploratory lane max per symptom, plus supporting seats (plan, review, verify) that do not write product code. Supporting seats can be parallel. Writers usually cannot.

Demo energy is five agents green-lighting each other in parallel. Prod energy is two lanes with clean cards and one human who can kill either without a meeting.

## Cut Until Every Running Agent Has a Card

If you cannot paste a lane card for an agent that is still running, stop it.

Kill the unnamed loop. Split the mega-brief. Demote the agent that only exists so you feel like you are using the stack hard. Promote the boring lane that leaves an inspectable trail and a revert path. Enforce the cards when you are tired, which is when you will want to "just let them all cook."

You do not need a perfect multi-agent framework to get this right. You need fewer concurrent writers, clearer seams, and a human name on every live run. Tools are cheap. Contracts are the work. Parallelism is optional. Ownership is not.

## The Bottom Line

Parallel agents without lane cards are not a team. They are a collision scheduled in advance.

Throughput comes from owned, bounded lanes with stop conditions and kill switches. Fan-out without ownership only multiplies the blast radius.
