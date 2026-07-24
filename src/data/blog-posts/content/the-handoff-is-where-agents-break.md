Something goes wrong in your multi-agent system. The final output is confidently, specifically wrong.

So you open the last agent's trace. You read its prompt, its reasoning, its tool calls. And the frustrating part is that none of it looks broken. Given what it was told, it did something reasonable. You swap in a better model. Same class of failure. You rewrite the prompt. Same class of failure.

The agent was fine. The brief it received wasn't.

This is the thing that surprises people about running more than one agent: the failures stop living inside the agents and start living in the space between them. We [wrote about that shift](/blog/your-second-agent-is-the-hard-one/) when you go from one agent to two. This post is about the part that comes after the realization — actually engineering that space.

## The Failure Rates Are Worse Than the Demos Suggest

There is now real data on this, and it is bracing.

Researchers behind the [MAST taxonomy](https://arxiv.org/abs/2503.13657) annotated 1,642 execution traces across seven state-of-the-art open-source multi-agent systems. It is worth knowing exactly how, because the how is what makes it usable: six human experts read 150+ traces to build the taxonomy, three of them then labeled independently until they reached 0.88 Cohen's kappa, and the full 1,642-trace dataset was labeled by an LLM-as-judge pipeline calibrated against those human annotations (94% accuracy, 0.77 kappa).

So it is not 1,642 hand-reads, and anyone citing it should say so. What it is, is a human-built and human-validated taxonomy applied at a scale humans could not reach — the closest thing the field has to a failure epidemiology.

Their headline: **41% to 86.7% failure rates.** The six systems the paper breaks out individually: AppWorld failed 86.7% of the time, HyperAgent 74.7%, ChatDev 66.7%, Magentic-One 62.0%, MetaGPT 60.0%, AG2 41.0%.

One honest caveat before anyone quotes that range at a standup, and it is the paper's own: these systems were measured on *different benchmarks*, so the numbers are not directly comparable to each other. It is not a leaderboard. What it is, is a floor-level observation that serious multi-agent systems built by serious people fail a lot, and the good ones still fail more than you would guess from a demo video.

## A Third of It Is the Seam

Here is the number this post is actually about.

MAST sorts every failure into three categories. **Inter-agent misalignment accounts for 32.3% of them.** Not the model being incapable. Not the task being impossible. Roughly a third of failures are agents failing to communicate correctly with each other.

Break that category open — all six sub-modes, so the arithmetic is checkable — and they are painfully recognizable:

- **Reasoning-action mismatch — 13.2%.** The agent's stated reasoning and its actual action diverge. It says it will check the schema, then doesn't.
- **Task derailment — 7.4%.** The work drifts from what was asked. Each handoff nudges it slightly, and no single step looks wrong.
- **Failure to ask for clarification — 6.8%.** The agent receives an ambiguous brief and resolves the ambiguity by guessing, silently.
- **Conversation reset — 2.2%.** The thread restarts and everything established up to that point is gone.
- **Ignoring another agent's input — 1.9%.** The information arrived. It was not used.
- **Information withholding — 0.85%.** An agent knows something relevant and does not pass it on.

Look at that list as a whole and a pattern falls out. Almost none of these are intelligence failures. They are **protocol** failures. The receiving agent was never told what it needed, never told what it was allowed to assume, and never given a way to say "this brief is underspecified."

One thing worth being precise about, because the sloppy version of this argument is everywhere: the 41–86.7% range is an *overall* failure rate, not a coordination-failure rate. The paper does not claim coordination causes most failures. It measures that inter-agent misalignment is 32.3% of them. The argument that this is the most *fixable* third is mine, not theirs.

## Why the Seam Is Invisible

Every agent in the chain looks locally correct. That is the whole problem.

When you debug a single agent, you have a clean pair: the input you gave it, the output it produced. When you debug a chain, the input to agent three is an artifact produced by agent two, which was itself working from agent one's artifact. By the time you inspect the failure, the original intent has been paraphrased twice.

Paraphrasing is lossy. Not dramatically — that would be easy to catch. It is lossy at the edges, in exactly the places that turn out to matter: the constraint that was mentioned once, the exception the user flagged in passing, the "don't touch the billing table" that agent one understood as context and agent two reasonably summarized away.

This is why "just use a better model" doesn't fix it. A better model paraphrases more fluently. It does not know which edge case you were going to care about, because that information was destroyed one hop upstream.

## Engineer the Seam Like an API

The fix is not more intelligence. It is treating the handoff as an interface with a contract, the same way you would treat a service boundary between two teams.

**Pass structure, not prose.** The single highest-leverage change is to stop letting agents hand each other paragraphs. A paragraph invites paraphrase; a schema doesn't. If agent two must produce `{ file, change, constraints[], unresolved[] }`, then `constraints` cannot get quietly dropped in a rewrite — a missing field is a visible, checkable error rather than an absence nobody notices.

**Make "I don't know" a first-class value.** The 6.8% clarification-failure mode exists because the schema had no slot for uncertainty. Give every handoff an explicit `unresolved` list, and make it legal — expected, even — for an agent to hand back work with three open questions instead of a confidently guessed answer. An agent that guesses silently is not being helpful; it is [failing quietly](/blog/agents-fail-quietly/), and quiet failure is the expensive kind.

**Validate at the boundary, not at the end.** Check the handoff artifact the moment it is produced, against the contract, before the next agent starts. A malformed brief caught at the seam costs one retry. The same brief caught after three more agents have built on it costs the whole run — and by then the evidence of what went wrong has been paraphrased out of existence.

**Carry provenance forward.** Every constraint in a handoff should say where it came from: the user, an upstream agent, or the agent's own inference. This one line of metadata is what lets a downstream agent — or you, reading the trace — tell the difference between a hard requirement and a guess that has been repeated so many times it looks like one.

**Keep the original brief reachable.** Don't let the user's actual words disappear behind two layers of summary. Pass a pointer to the source alongside the summary, so any agent in the chain can go check the original instead of trusting the paraphrase. This is the cheapest possible fix and it is skipped constantly.

## The Boring Discipline

None of this is exotic. It is schema validation, explicit nullability, provenance, and error handling — the same things we learned to do at service boundaries twenty years ago, applied to a boundary we have been pretending is a conversation.

That pretense is the root of it. We describe agents as "talking to each other," and that framing quietly imports every assumption we make about human conversation: that context is shared, that ambiguity gets resolved by asking, that the listener will flag something that sounds off. None of that is true by default here. It is true only if you build it.

The good news is that this is the tractable third. You cannot make the model smarter this quarter. You can absolutely make the message between agent two and agent three a validated object with a slot for "here is what I wasn't sure about."

Start there. The next time an agent produces something confidently wrong, before you touch its prompt, go read what it was handed. The bug is upstream more often than it has any right to be.
