import { BlogPost } from "./types";

export const somebodyHasToOwnTheAgent: BlogPost = {
  slug: "somebody-has-to-own-the-agent",
  title: "Somebody Has to Own the Agent",
  subtitle:
    "Gartner expects more than 40% of agentic AI projects to be canceled by the end of 2027. None of the three reasons it names is a model-capability problem. The gap that kills agents in production is organizational, and we already know how to close it.",
  date: "2026.08",
  dateISO: "2026-08-25",
  readTime: "7 min",
  tags: ["ai", "agents", "leadership", "governance", "engineering"],
  image: "/images/blog-somebody-has-to-own-the-agent.webp",
  content: `Your agent has been in production for three months. It files tickets, moves money, or emails customers on your behalf. Now answer one question: whose name is on it?

Not which team deployed it. Not who wrote the prompt. Who is accountable when it does something expensive at 2am on a Sunday — the person who gets paged, who decides whether to shut it off, and who answers for that decision on Monday.

For a lot of agents running in production right now, that box on the org chart is empty. The agent has a repo, a budget line, and real permissions. It does not have an owner. And the failure that eventually takes it down will not be a model failure.

## The Reasons Projects Die Are Not Technical Reasons

Gartner predicts that [more than 40% of agentic AI projects will be canceled by the end of 2027](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027), citing escalating costs, unclear business value, or inadequate risk controls.

Read that list again slowly, because the interesting thing about it is what is missing. Not one of those three is a capability problem. A smarter foundation model does not fix escalating costs, does not clarify business value, and does not install risk controls. Every one of them is a question about who decided what, and who was watching.

That reading is mine, not Gartner's. But the list is Gartner's, and it is remarkably consistent with what the same analysts say is driving the hype in the first place. Anushree Verma, Senior Director Analyst at Gartner, put the underlying problem this way: "Most agentic AI propositions lack significant value or return on investment, as current models don't have the maturity and agency to autonomously achieve complex business goals or follow nuanced instructions over time."

The market is not helping. Gartner describes widespread "agent washing" — rebranding assistants, RPA, and chatbots as agents without substantial agentic capability — and estimates that only around 130 of the thousands of self-described agentic AI vendors are real. If you are buying rather than building, most of what you evaluate is a wrapper with a new label, and nobody inside your company is positioned to say so unless somebody owns the outcome.

## Adoption Is Not Deployment

Forrester's [State of Agentic AI in 2026](https://www.forrester.com/blogs/the-state-of-agentic-ai-in-2026-companies-are-chasing-few-are-catching/) frames the same gap from the other side: three-quarters of enterprise leaders say they are adopting agentic AI, while only a small minority have it running in meaningful production beyond what Forrester calls "agentish" chatbots.

That distance between adopting and running is where ownership lives. It is easy to sponsor an agent. It is easy to fund a pilot. What is hard, and what almost nobody staffs for, is the unglamorous ongoing work: watching cost per run drift up, noticing that the success rate slipped four points after a model update, deciding the agent should stop doing one of the five things it was scoped to do.

Forrester's recommendation is specific and, I think, correct: treat every agent as a governed identity. "Give it unique credentials, least privilege, full logging, and a named owner who manages its lifecycle — no unowned autonomy."

Worth being precise about what that is. It is a recommendation, not a measurement. Forrester is not reporting that companies with named owners succeed at some rate; it is saying that unowned autonomy is a bad idea. I have looked for a clean survey number tying named ownership to agent outcomes and have not found one that survives checking — the figures floating around on this are mostly untraceable. So take the following as an argument from practice rather than a finding.

## We Already Learned This With Services

None of this is new. It is on-call, rediscovered.

Fifteen years ago you could ship a service into production with no named owner, and the industry spent a decade learning why that ends badly. The answer we converged on was not better monitoring software. It was a person: a service has an owner, the owner has a pager, the pager has an escalation path, and the owner has enough authority to change the thing they are accountable for. Ownership without authority is just blame with extra steps.

Agents need the same structure, and they need it more urgently, because an agent can do damage at a speed and breadth that a broken service usually cannot. A service that falls over stops working. An agent that goes wrong [keeps working, confidently, in the wrong direction](/blog/agents-fail-quietly/).

So the useful question is not "do we have an AI governance policy." It is the on-call question, asked about each agent individually:

- Who gets paged when this agent misbehaves, by name?
- Can that person turn it off without convening a meeting?
- Can they see what it actually did, step by step, or only that it returned a 200?
- Do they own the budget it spends, so that cost drift is their problem and not a surprise in someone else's quarterly review?
- Is there a number that tells them whether it is working — not "is it up," but is it producing the outcome it was funded to produce?

If you cannot answer those five for an agent you are running today, it is unowned, whatever the slide deck says.

## The Trap: One Policy for Every Agent

The most common way teams get this wrong is not neglect. It is over-correcting into a single uniform policy.

Gartner published a specific warning about this in May 2026: [applying uniform governance across AI agents will lead to enterprise AI agent failure](https://www.gartner.com/en/newsroom/press-releases/2026-05-26-gartner-says-applying-uniform-governance-across-ai-agents-will-lead-to-enterprise-ai-agent-failure). Shiva Varma, Senior Director Analyst at Gartner, states the failure mode directly: "Enterprises are treating AI agent governance as binary, either locked down or fully trusted, and that is the root cause of failure."

The distinction Gartner says organizations miss is between an agent's ability to act and the scope of access it is granted. Those are two different dials, and collapsing them is exactly how you end up with a summarizer holding production database credentials, or a genuinely useful workflow agent throttled into uselessness because it got classified alongside it. Gartner's recommendation is proportional governance: classify agents across distinct autonomy levels, where each level is a different trust boundary with its own requirements.

This is the same argument I made about [agent permissions being product design](/blog/agent-permissions-are-product-design/), arriving from the governance side. A permission model is not a compliance artifact you bolt on at the end. It is a description of what the agent is for.

Gartner also predicts that by 2027, 40% of enterprises will demote or decommission autonomous AI agents due to governance gaps identified only after production incidents occur. That last clause is the whole problem in six words. The gap was there the entire time. It became visible when something broke.

## What an Owner Actually Does

Naming an owner is the easy half, and it is where most orgs stop. The name goes in a spreadsheet cell and nothing else changes.

An owner who can actually do the job needs three things, none of which are usually granted at the same time as the title:

**Visibility.** They have to be able to reconstruct what the agent did and why. Not logs — [traces](/blog/trust-comes-from-the-trace/). If the only available evidence is that the run completed successfully, the owner cannot form a judgment, and so they cannot be responsible for one.

**Authority to change scope.** They can narrow the agent's permissions, pause a workflow, or retire a capability without a committee. If turning the agent off requires the approval of the executive who sponsored it, the agent is not owned. It is protected.

**A number they are accountable to.** Not usage. Outcome. Tickets resolved without rework, hours saved against a baseline someone measured before launch, error rate per hundred runs. Agents that cannot be evaluated get renewed forever on vibes, right up until the cost review that kills them — which is, roughly, the first of Gartner's three cancellation reasons.

## The Empty Box

The uncomfortable version of this post is short. Most organizations running agents in production could not, today, produce a name for each one.

That is fixable this week, and it does not require a platform, a vendor, or a framework. List every agent you have running. Put a human name next to each. For any row where you cannot, either find the name or turn the agent off until you can.

Some of those rows will be hard to fill, and the difficulty is the signal. An agent nobody will put their name on is an agent nobody believes in enough to defend — and it is running with your credentials anyway.

The scaling problem in front of most teams is not that the models are not good enough yet. It is that we have deployed a new class of actor into our companies and skipped the part where we decide who is responsible for it.

Somebody has to own the agent. Right now, for most agents, nobody does.`,
};
