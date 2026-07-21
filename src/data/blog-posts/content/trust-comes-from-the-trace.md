An agent closes a customer ticket it should have escalated. You go looking for what happened. The request logged a clean 200. The final message reads fine. Latency was normal. Every line in the log says the run was healthy.

And you still have no idea why it did what it did.

That is the gap I want to talk about. Not "did the agent fail," which you can often catch. Something harder. "The agent did something surprising, and I cannot reconstruct the path it took to get there."

I have written about bounding what an agent can touch, measuring when it fails quietly, giving it an undo button, and teaching it when to ask a human. Each of those makes the agent's mistakes smaller or more survivable. None of them tells you *why* a specific run went the way it did. For that you need to be able to replay the decision. And most teams cannot.

## A Log Says What Happened. It Does Not Say Why.

Traditional monitoring was built for deterministic services. The same input produces the same output, every request follows a known code path, and a 200 is a strong signal that things went right. Agents break all three assumptions. The same prompt can produce different tool calls on different runs, the path branches on model output, and [a 200 can wrap a confidently wrong answer](https://www.braintrust.dev/articles/agent-tracing-debug-ai-agents-production).

So the usual stack shows you the outside of the run and none of the inside. It can tell you the request returned successfully. It cannot tell you that the agent [looped twice, called the wrong tool, and hallucinated a billing policy](https://www.braintrust.dev/articles/agent-tracing-debug-ai-agents-production) on the way to that successful-looking answer. The most dangerous agent failures are the ones that look like success: well-formed but wrong outputs, redundant tool calls, semantically invalid actions. A binary up-or-down check waves all of those through.

The uncomfortable part is how few teams have anything better. Gartner puts spending on LLM observability at [15% of GenAI deployments today, and expects it to reach 50% by 2028](https://www.gartner.com/en/newsroom/press-releases/2026-03-30-gartner-predicts-by-2028-explainable-ai-will-drive-llm-observability-investments-to-50-percent-for-secure-genai-deployment). The direction of travel is obvious, but the baseline is the part worth sitting with: most agents in production right now are black boxes to the people who run them.

## A Trace Is the Inside of the Decision

The fix is not more logs. It is a different shape of record: a trace.

A log is a flat list of events. A trace is the causal tree. Every reasoning step, every tool call, every retrieval, every decision branch becomes [a nested span linked to the step that caused it](https://greptime.com/blogs/2026-05-09-opentelemetry-genai-semantic-conventions). Open one and you can walk the whole path from the initial request to the final action: what the agent saw, what it decided, which tool it reached for, what came back, and what it did next.

That is the difference between "the ticket got closed" and "the agent read the ticket, retrieved the wrong policy doc, concluded the issue was resolved, and closed it without checking the account flag." The first is a log line. The second is a trace, and it is the only one of the two you can actually learn from.

Concretely, a trace worth keeping captures three things for every run:

- **Every model call**, with the prompt, the context it was given, and the raw response. Not a summary. The actual input and output, because that is where wrong decisions are born.
- **Every tool call and retrieval**, with arguments and results, linked to the reasoning step that triggered it. This is where you catch the wrong tool, the malformed argument, the stale document.
- **Every decision branch**, so a non-deterministic run is still reconstructable after the fact. When the same prompt could have gone three ways, you want to know which way this run went and what tipped it.

Get those and a surprising run stops being a mystery. It becomes a recording you can scrub through.

## You Do Not Have to Build This From Scratch

The good news is that this is standardizing. OpenTelemetry, the same tracing standard most backends already use, [formed a GenAI group to define spans for LLM calls, agent orchestration, and MCP tool calls](https://greptime.com/blogs/2026-05-09-opentelemetry-genai-semantic-conventions). The conventions are still moving, so treat attribute names as not-yet-frozen, but the shape is real and you can adopt it today. Most agent frameworks and observability platforms can [emit and read agent traces](https://www.langchain.com/resources/agent-observability) without you hand-rolling the plumbing.

If you want a place to start, start small and specific:

Instrument the model call and the tool call first. Those two spans explain the majority of surprising behavior, because that is where the agent's intent turns into an action against the real world.

Keep the raw inputs and outputs, not summaries. The moment you compress a trace down to "called billing tool, got result," you have thrown away the exact detail you will need at 2am.

Make one real run replayable end to end before you scale. If you can open a single production run and narrate every step out loud from the trace alone, the instrumentation is working. If there is a gap you have to guess across, fix that gap before you add more agents.

## Observability Is How Trust Gets Earned

There is a strategic reason this matters beyond debugging. The thing keeping most agent pilots from graduating to production is not capability. It is trust. Leaders will not hand real authority to a system whose decisions they cannot inspect. Gartner frames the same dynamic from the other side: as enterprises scale GenAI, ["the trust requirement grows faster than the technology itself"](https://www.gartner.com/en/newsroom/press-releases/2026-03-30-gartner-predicts-by-2028-explainable-ai-will-drive-llm-observability-investments-to-50-percent-for-secure-genai-deployment) — which is exactly why observability spend is forecast to triple as a share of deployments.

That is the quiet payoff. A trace is not only how you debug a bad run. It is how you show a skeptical stakeholder exactly what the agent did and why, how you satisfy an auditor, how you prove after an incident that you can explain the machine you are running. An agent you can replay is an agent you can defend. An agent you cannot replay is one you are asking everyone to take on faith, and faith does not survive the first surprising ticket.

## The Bottom Line

We spend enormous effort trying to make agents make the right decision. We spend almost none making sure we can see the decision after the fact. That is backwards, because the agent will occasionally be surprising no matter how good it gets, and the only question that matters in that moment is whether you can reconstruct what it did.

Bounding limits the damage. Detection catches the miss. An undo button takes it back. Escalation routes the hard calls to a human. But all four assume you can eventually understand what happened. Observability is the layer that makes that assumption true.

So before you give your agent more to do, ask the plain question. When this does something I did not expect, can I replay exactly how it got there? If the answer is no, the problem is not that the agent needs a better prompt.

It is that you cannot see it think.
