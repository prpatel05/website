import { BlogPost } from "./types";

export const yourSecondAgentIsTheHardOne: BlogPost = {
  slug: "your-second-agent-is-the-hard-one",
  title: "Your Second Agent Is the Hard One",
  subtitle:
    "Going from one agent to many does not multiply what you can do. It moves every failure into the space between them.",
  date: "2026.07",
  dateISO: "2026-07-28",
  readTime: "7 min",
  tags: ["ai", "agents", "reliability", "engineering"],
  image: "/images/blog-your-second-agent-is-the-hard-one.webp",
  content: `Two of the most-shared pieces of engineering writing about agents say the opposite thing.

Cognition published [Don't Build Multi-Agents](https://cognition.com/blog/dont-build-multi-agents), arguing that splitting work across parallel agents is fragile by construction. Anthropic published its [multi-agent research system](https://www.anthropic.com/engineering/built-multi-agent-research-system), reporting that an orchestrator with parallel subagents beat a single strong model by 90.2 percent on their internal research eval.

Both teams are serious. Both are describing real systems. And most people reading them treat the disagreement as a matter of taste, or of who had the better framework.

It isn't. They're describing two different kinds of work, and the difference between those two kinds is the single most useful thing I know about scaling from one agent to a fleet.

## The First Agent Is an Engineering Problem

Everything I've written about agent reliability so far assumes a boundary around one agent. Decide [what it's allowed to touch](/blog/agent-permissions-are-product-design). Give it [a runbook instead of a better prompt](/blog/agent-runbooks-beat-better-prompts). Notice [when it fails quietly](/blog/agents-fail-quietly). Make its mistakes [cheap to take back](/blog/give-your-agent-an-undo-button). Teach it [when to stop and ask](/blog/teach-your-agent-to-ask-for-help). Keep [a trace of what it did](/blog/trust-comes-from-the-trace).

Every one of those controls is scoped to a single actor. The permission set belongs to an agent. The undo button unwinds one agent's actions. The escalation gate pauses one agent's decision. The trace reconstructs one agent's run.

Add a second agent and none of those controls break in an obvious way. They just stop covering the interesting part, because the interesting part is now between the two of them.

Who owns the shared file when both agents want to write it? When agent A assumes the API returns cents and agent B assumes dollars, whose trace shows the bug? When the run goes wrong at step nine of a forty-step plan spread across five agents, which agent gets the pause? Nothing in a single-agent design answers these. They're not engineering questions anymore. They're organizational ones.

That's the actual shape of the jump. The first agent is a systems problem you can solve with better tools. The second agent is a coordination problem you solve with better contracts, and coordination problems have never been solved by making the individual participants smarter.

## The Failures Are Boring, Which Is the Bad News

There's now real data on how these systems fail. A team from Berkeley and collaborators read [150 execution traces](https://arxiv.org/abs/2503.13657) closely enough to build a taxonomy of what actually goes wrong, then used it to annotate more than 1,600 traces across seven popular multi-agent frameworks. They found fourteen distinct failure modes, with high agreement between the human annotators, sorted into three buckets: system design issues, inter-agent misalignment, and task verification.

Read that list again and notice what isn't on it. Not "the model wasn't capable enough." Not "reasoning was too shallow." The failures are specification, coordination, and checking the work. If you replaced every agent in those traces with a smarter model, most of those traces would still fail, which is roughly what the authors concluded when they said the failures they found demand more sophisticated solutions than surface-level fixes.

I find this genuinely clarifying, and a little deflating. We're rediscovering, at great expense, that a team of capable individuals with unclear ownership and no shared definition of done produces worse work than one competent person. Gartner's forecast that [over 40 percent of agentic AI projects will be canceled by the end of 2027](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027) blames escalating cost, unclear value, and inadequate risk controls. Management problems, not model problems.

Cognition names the mechanism precisely. Actions carry implicit decisions, and conflicting decisions carry bad results. Their example is a Flappy Bird clone split between two subagents: one renders a background in the style of Super Mario Bros., the other builds a bird that doesn't match anything, and the orchestrator is left holding two incompatible halves. Neither subagent did anything wrong by its own lights. They just each made a silent decision the other never saw.

## Parallelize Reading. Serialize Writing.

So why did Anthropic's fleet work?

Look at what those subagents were doing. Searching. Reading. Exploring independent branches of a research question, then handing back findings that get synthesized by a lead agent. Nothing any subagent does changes what another subagent sees. The context each one gathers is additive. Two agents finding the same source is redundant, not contradictory. And the cost of that architecture was roughly fifteen times the tokens of a normal chat, which is a fine trade when the alternative is a question that doesn't fit in one context window at all.

Now look at the Flappy Bird case. Both subagents were writing to one artifact. Every choice one made silently constrained the other. Their outputs don't merge, they collide.

That's the variable. It isn't framework, orchestration topology, or prompt quality:

**Parallelize reading. Serialize writing.**

Fan out as widely as you like across work that only reads. Search, retrieval, analysis, exploring five approaches to see which is viable, reviewing a diff from six angles. The results combine cleanly because nothing contended for shared state. This is exactly the workload where a fleet pays for itself, because you're buying breadth that a single context window can't hold.

Then narrow to one writer for anything that mutates shared state. One agent holds the pen for a given artifact. Not one agent for the whole system. One agent per thing that can be written.

Most multi-agent designs I see get this backwards. They parallelize the writes, because that's where the wall-clock time is, and then spend the savings debugging conflicts that never had to exist.

## Contracts, Not Conversations

Once you accept that constraint, the rest of a fleet design falls out of it.

**Make handoffs artifacts, not chat.** Agents passing messages recreates every ambiguity of a hallway conversation, and current models are bad at the social reasoning that makes hallway conversations work. Have agents produce structured, inspectable outputs that the next agent consumes as input. A file, a diff, a typed result. Something you can look at afterward and say: this was correct when it left agent A, and agent B mishandled it. Chat transcripts don't let you say that.

**Pass the full trace, not the summary.** Cognition's first principle is to share complete agent traces rather than individual messages, and it's the right call. A subagent that receives a one-line task description will invent everything the description left out. The invented parts are where conflicts come from.

**Give shared state an owner.** For every resource two agents can touch, name the one that writes. The others read. If two agents genuinely must write the same thing, that's not a coordination problem to solve with better prompts. That's a design smell telling you the work was split along the wrong seam.

**Trace across the fleet, not per agent.** A per-agent trace tells you what each one did. It won't tell you that agent B's correct action was based on agent A's wrong assumption. You need spans that link, so the causal chain survives the hop between agents. Reconstruction was already [the foundation of trust in a single agent](/blog/trust-comes-from-the-trace). In a fleet it's the only thing standing between you and a bug that no single trace contains.

**Escalate at the seams.** The most valuable place for a human pause isn't inside an agent's reasoning. It's at the handoff, where one agent's output becomes another's assumption, and where a wrong assumption is still cheap to catch.

## The Bottom Line

The question to ask before adding an agent isn't "could a second agent do this in parallel." It almost always could. The question is what the two of them will contend over, and who decides when they disagree.

If the answer is nothing, they contend over nothing, then fan out. Run ten. The read-only fleet is one of the genuinely good deals in this technology, and it's why the research-agent results are real.

If the answer involves shared state, a shared artifact, or a decision that has to be consistent across both, then a second agent doesn't split the work. It splits the ownership, and hands you a distributed-systems problem you now have to solve in natural language, with participants that don't reliably remember what they agreed to.

One agent that reads widely and writes carefully will beat five that all think they're holding the pen.

Your second agent isn't a second worker. It's the first day your agents needed a manager.`,
};
