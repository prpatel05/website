import { BlogPost } from "./types";

export const yourAgentsAreAnAttackSurfaceNow: BlogPost = {
  slug: "your-agents-are-an-attack-surface-now",
  title: "Your Agents Are an Attack Surface Now",
  subtitle:
    "Almost everyone knows this is dangerous. Almost nobody has done anything about it. That gap is the whole story.",
  date: "2026.09",
  dateISO: "2026-09-01",
  readTime: "7 min",
  tags: ["ai", "agents", "security", "governance"],
  image: "/images/blog-your-agents-are-an-attack-surface-now.webp",
  content: `There is a sentence in a [Gartner survey of 360 IT application leaders](https://www.gartner.com/en/newsroom/press-releases/2025-09-30-gartner-survey-finds-just-15-percent-of-it-application-leaders-are-considering-piloting-or-deploying-fully-autonomous-ai-agents) that I keep coming back to, because it says two things at once and the second one undoes the first:

> "74% believe that AI agents represent a new attack vector into their organization and only 13% strongly agreed that they had the right governance structures in place to manage them."

Same survey. Same respondents. Same sentence.

Three quarters of them have looked at what they are deploying and concluded, correctly, that it is a new way into their company. And when asked whether they had built the controls to manage that, roughly one in eight was willing to strongly agree.

I want to be careful about what that second number is, because it is easy to inflate. 13% is a top-box response — the share who *strongly* agreed. The people who mildly agreed, or sat in the middle, are not reported. So this is not "87% have no governance." It is something more specific and, I think, more damning: when asked to say plainly that they had this handled, almost nobody would.

## The Deployment Already Happened

The tempting read is that this is a pre-deployment jitter — enterprises eyeing agents warily, governance arriving before the rollout does.

The same survey closes that escape hatch. **75% of respondents said they were piloting, deploying, or had already deployed some form of AI agent.** The agents are in the building. The governance question is not hypothetical, and it is not early.

What *is* still rare is full autonomy: only **15%** said they were considering, piloting, or deploying fully autonomous agents — the goal-driven kind that runs without human oversight. So the current state of the world is a large population of supervised or semi-supervised agents, deployed broadly, governed by structures their own owners won't vouch for.

One more number from that survey, and it is the one I find most telling: only **19% had high or complete trust in their vendor's ability to provide adequate hallucination protection.** Read those together. Most organizations have agents in production. Most think agents are a new attack vector. Most don't trust the vendor to have handled the reliability problem. And almost none will claim they've built the controls themselves.

That is not a technology gap. Everyone involved has correctly diagnosed the situation. It is an execution gap, and execution gaps have causes.

## Why the Gap Persists

The obvious explanation is that governance is slow and shipping is fast. True, but incomplete, and it doesn't explain why the organizations that *do* invest in agent governance still end up in trouble.

Gartner's later work names the actual mechanism, and it rings true against everything I have seen:

> "Enterprises are treating AI agent governance as binary, either locked down or fully trusted, and that is the root cause of failure." — Shiva Varma, Senior Director Analyst, [Gartner, May 2026](https://www.gartner.com/en/newsroom/press-releases/2026-05-26-gartner-says-applying-uniform-governance-across-ai-agents-will-lead-to-enterprise-ai-agent-failure)

Binary governance fails in both directions at once, which is what makes it so durable. Apply heavy controls uniformly and you smother the trivial agents — the summarizer, the code explainer — which slows delivery and, more corrosively, pushes people to build their own unsanctioned ones. Apply light controls uniformly and the agent with write access to production inherits the risk posture of a document summarizer.

Most organizations, having been burned once in one direction, overcorrect into the other. Neither setting is right, because the question was never "how much governance" — it was "governance of *what*."

## A Ladder, Not a Switch

The useful reframe is that agents don't have a risk level. They have an *autonomy* level, and risk follows from it. Gartner's recommendation — and I want to flag clearly that this is a recommendation, not a measurement of what companies do — is to classify agents across distinct autonomy levels, each with its own trust boundary and its own controls:

**Level 1 — Observe.** Read-only access to defined data sources, outputs visible only to the requesting user. Summarization, retrieval, code explanation. Risk is confined to data exposure and output accuracy, so controls stay lightweight: scoped access, authentication, usage logging, basic testing.

**Level 2 — Advise.** The agent generates recommendations, drafts, proposed actions. Humans review and execute. Still read-only. The new risk here is subtle and worth sitting with — an advisory agent *anchors judgment*. Automation bias means a confidently wrong draft becomes the starting point a human edits rather than the claim a human evaluates. Level 1 controls plus accuracy and hallucination testing, plus — notably — user training on how much to rely on it.

**Level 3 — Act with Approval.** The agent writes data, sends communications, changes configuration, but only after explicit human approval of each action. This is where most organizations think they are safe, and Gartner's warning is the sharpest line in the release: human review is a real control *only if it stays meaningful*. Without audit trails and agent-specific incident response, "approvals can degrade under time pressure or approval fatigue, creating a false sense of safety while expanding the attack surface." A rubber-stamped approval is worse than no approval, because it manufactures a record of oversight that didn't happen.

**Level 4 — Act Autonomously.** The agent acts within guardrails; humans review exceptions, logs, and aggregate outcomes rather than individual decisions. Actions now happen at a speed and scale that outpaces human oversight by design. This is the level that demands continuous monitoring, enforced guardrails, rapid rollback, circuit breakers that halt operation on threshold violations, and named ownership of agent behavior.

If that ladder feels familiar, it should. We [argued a version of it from product instinct](/blog/agent-permissions-are-product-design) — that the permission surface *is* the product, and capability should be granted in increments rather than handed over wholesale. The interesting development is that the industry analysts have now converged on the same shape from the governance side. Two different disciplines, walking toward the same ladder.

## The Part That Should Worry You

Gartner's prediction attached to that research:

> "By 2027, 40% of enterprises will demote or decommission autonomous AI agents due to governance gaps identified only after production incidents occur."

Sit with the clause at the end. Not *governance gaps*. Governance gaps **identified only after production incidents occur**.

The prediction isn't that agents will fail. It's that organizations will discover the shape of their own exposure by having it exploited, and their response will be to walk the agent back down the ladder — or off it entirely. That is the expensive path to the same knowledge. You get the incident, the postmortem, the rollback, and the internal credibility damage that makes the next agent proposal harder, all to learn a thing you could have written down in an afternoon.

And it connects directly to the 13%. An organization that cannot say it has the right governance structures is an organization that does not yet know where its gaps are. The incident is what tells them.

## What Actually Moves the Number

I'm wary of ending on a checklist, because checklists are how governance became a compliance exercise instead of an engineering one. So let me put it as the smallest set of things that separate an agent you can defend from one you can only hope about:

**Know which rung each agent is on.** Not a vibe — a written classification. Most organizations cannot produce a list of their deployed agents with an autonomy level next to each one, and everything else is downstream of that list existing.

**Make approval expensive enough to be real.** If a human is the control at Level 3, then approval fatigue is a security vulnerability, and it should be monitored like one. If people are approving 200 actions a day, you don't have a control, you have a formality with an audit trail.

**Build the rollback before you need it.** Circuit breakers and rapid rollback are Level 4 requirements precisely because at Level 4 the damage outpaces the human. This is the same argument as [giving your agent an undo button](/blog/give-your-agent-an-undo-button), promoted from a nice developer affordance to an organizational control.

**Name an owner.** An agent with no named owner has no one whose job it is to notice it drifted a rung upward when someone quietly granted it write access.

None of that requires trusting a vendor, and none of it requires a new product category. It requires deciding that the agents you have already deployed are infrastructure, and governing them the way you govern infrastructure.

## The Honest Caveat

That Gartner survey was fielded in May and June of 2025, among 360 IT application leaders at organizations of 250+ employees across North America, Europe, and Asia/Pacific. In a field moving this fast, a survey from mid-2025 is a photograph, not a live feed, and some of those organizations have surely closed the gap since.

But I would not bet on the gap closing faster than the deployments grew. The population of agents in production has gone up considerably since that survey went out. The number of organizations that could strongly agree they have the right governance structures has not obviously kept pace.

74% already know. The work is in the other number.`,
};
