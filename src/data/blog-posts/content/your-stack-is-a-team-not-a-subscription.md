I paid for five AI subscriptions last month and still lost a day to the same bug twice.

Not because the models were dumb. Because Claude Max had half the diagnosis, ChatGPT Pro had a cleaner rewrite of the plan, Cursor had a half-applied patch, SuperGrok had a sharp objection I never pasted back, and Antigravity had a UI walk that contradicted all of them. Five competent opinions. Zero owner of the seam between them. I closed the laptop with more tabs than when I opened it.

The usual story is that you need a better model, or a bigger plan tier, or one more tool that "ties it all together." The inversion is quieter. Your stack is not a shopping cart. It is a team. Subscriptions without roles just multiply tabs. A paid stack is not leverage until each tool has a job, a handoff, and a named owner for the handoff.

This is the second post in **Ship With Agents**. The first was about letting an agent run for days without becoming a liability. This one is about the division of labor across the tools you already pay for.

## Five Tabs Is Not Five Roles

Open your browser right now and count the AI surfaces you treat as interchangeable.

Claude Max for long reasoning. ChatGPT Pro for another pass. SuperGrok when you want a harder pushback. Cursor when you want the repo in the loop. Antigravity when you want a browser-native agent to walk the product. That list is mine. Yours will rhyme. The point is not the logos. The point is that most people use them as five versions of the same chat window.

A team is not five people who can all "help with the thing." A team is five people who know what they own, what they hand off, and who gets paged when the handoff is wrong. If every tool can do everything, none of them is accountable for anything. You end up with parallel drafts of the same plan, each quietly overwriting the last in your head.

I used to treat model-hopping as taste. It felt like diligence: get a second opinion, then a third. What it actually was, most days, was refusing to decide which surface owned the current phase of the work. Diligence without a contract is just context thrash with a receipt.

## A Role Is a Job Plus a Handoff

The mechanism is simple enough to write on a sticky note. For each tool you keep paying for, fill three lines:

1. **Job.** What phase of work this tool is allowed to own (plan, critique, implement, walk UI, overnight loop).
2. **Handoff.** What artifact it must leave for the next role (structured brief, diff against a branch, repro steps with evidence, unresolved list).
3. **Owner.** Who is on the hook if that handoff is garbage (usually you, sometimes a named agent run with a kill switch).

That is the whole operating model. Not a vendor matrix. Not a feature comparison. A job, a seam, a name.

When I say handoff, I mean a contract, not a vibe. The receiving surface should not have to reconstruct intent from a screenshot of a chat. Pass structure: goal, constraints, blast radius, current hypothesis, what was already ruled out, and what "done" means in the product. If you cannot paste that into the next tab in under a minute, you do not have a handoff. You have a mood.

Bounded, reversible, inspectable still applies. The role card should say what the tool may write, what it may only read, and how you reverse a bad afternoon. Overnight loops belong to the tool that can keep a trail (see the first post in this series). Critique belongs to the tool you trust to be rude. Implementation belongs to the surface that can see the repo and open a PR you can revert.

The unglamorous part: you will demote tools. Some subscriptions stop being teammates and become occasional consultants. That is healthy. A team with six "full stack" generalists and no owners is how you get five half-finished approaches and a demo that never becomes prod.

## My Stack as a Roster (Not a Review)

Here is how I currently assign the tools I actually pay for. This is a roster, not a product endorsement. The names will change. The shape should not.

**Claude Max: long-horizon planning and overnight loops.** It owns the multi-hour or multi-day goal when the work needs a durable trail: reproduce, trace, fix, verify. It does not own the final taste pass on copy, and it does not own "argue with me until I feel smart." Job is persistence with a stop condition. Handoff is a log someone can audit plus a PR-shaped change, not a novel.

**ChatGPT Pro: structured briefs and second-pass compression.** It owns turning a messy problem into a contract the next tool can execute: constraints, acceptance checks, unresolved questions. It is also where I send a bloated plan to get cut. Handoff is a short schema-ish brief, not another essay.

**SuperGrok: adversarial review.** It owns the "what am I missing" seat. I feed it the brief and the proposed approach and ask it to find the hole, the overclaim, the blast radius I waved away. Handoff is a punch list of risks and falsifiers. If it starts rewriting the feature, I pulled it out of its lane.

**Cursor: repo-local implementation.** It owns the change in the codebase: branch, diff, tests, the PR I can revert. Handoff into Cursor is the brief plus the constraints. Handoff out is a PR with a stop condition you can verify, not a chat summary that says "should work."

**Antigravity: product-path walking.** It owns entering the real UI (or the staging twin), reproducing, and bringing back evidence. Screenshots, trace ids, failing-then-passing paths. Handoff is evidence, not a status sentence. If the walker cannot fail the old repro after the fix, the implementer is not done.

Notice what is missing from that roster: a tool whose job is "be open in case I need it." If a subscription has no job, it is not on the team. It is inventory.

## A Worked Afternoon: One Bug, Five Seats, One Owner

Here is a concrete run shaped like a real day, not a stage demo.

The bug: a settings save looks fine in the happy path, then quietly drops one field after a refresh. Classic. Easy to talk about. Easy to "fix" in the wrong layer.

I start in ChatGPT Pro with a five-minute brief, not a therapy session. Goal: preserve field X across save and reload on staging. Blast radius: staging only, test user, no prod writes. Stop condition: scripted reload shows X still present, plus a regression note for the empty-field case. Unresolved: whether the drop is client state, API omit, or a cache header. That brief is the contract.

SuperGrok gets the brief and the current hypothesis ("client state"). It comes back with three punches: check the PATCH payload, check whether empty string is treated as omit, check whether a second tab races the write. I do not ask it to rewrite the app. I ask it to make the next role harder to fool.

Claude Max (or a long Cursor agent session, depending on the week) owns the loop: reproduce on the path, trace, smallest reversible fix, verify on the same path. The trail has to survive a tab crash. If it cannot, I am not ready to walk away.

Antigravity walks the UI with the same repro script the brief named. It returns evidence. Not "looks good." A before/after on the reload, and a note if the empty-field case still fails.

Cursor (when the long loop was outside it) lands the PR: small diff, test or scripted check attached, revert path obvious. I am the owner of the seam between every hop. If SuperGrok's punch list never reached the implementer, that is my failure, not the model's. If Antigravity verified a different flow than the one Claude fixed, that is my failure at the contract.

The day works when each seat does one job and the artifacts move. The day fails when I paste the same vague prompt into five tabs and pick the answer that flatters me.

## Ownership Does Not Travel With the Receipt

Paying for Claude Max does not make Anthropic on-call for your bad handoff. Paying for Cursor does not make the IDE responsible for the fact that you never wrote a stop condition. Parallel tabs do not dilute ownership. They multiply the places where a quiet failure can hide.

This is the same lesson as naming an owner for an agent in production, applied one layer up to the human workflow. Someone has to care whether the brief that left ChatGPT still matches the PR that left Cursor. Someone has to notice when Antigravity is verifying a demo path while prod still breaks. That someone is you until you design otherwise.

Blast radius compounds across an unowned stack. One tool with write access is a risk you can name. Five tools with overlapping write access and no handoff log is how you get a "fix" that touched billing copy, a flaky test, and a config flag nobody can explain on Monday.

The next posts in this series pick up adjacent seams: checking in from a phone without pretending the phone is a full IDE, picking models for jobs instead of vibes, and what happens when parallel agents need ownership too. The through-line does not change. Tools are cheap. Contracts are the work.

## Cut Until the Roles Are Obvious

If you cannot explain your stack as a roster in one minute, you have too many generalists and not enough jobs.

Cut the subscription that only exists so you do not feel locked in. Merge the two tools that always produce the same kind of artifact. Promote the one surface that actually leaves inspectable trails. Write the sticky notes. Enforce them when you are tired, which is when you will want to paste the same prompt everywhere.

You do not need a perfect org chart for your AI tools. You need fewer tabs with clearer seams. Demo energy is five models agreeing in parallel. Prod energy is one owner, one contract, and a handoff you can reverse.

## The Bottom Line

A paid stack is inventory until each tool has a job, a handoff, and an owner.

Subscriptions buy access. Roles buy leverage. Tabs without contracts buy noise.
