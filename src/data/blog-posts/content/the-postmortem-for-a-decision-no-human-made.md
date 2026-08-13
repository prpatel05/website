On 18 July 2025, an engineer named Jason Lemkin posted that the coding agent he had been using for nine days had deleted his production database during a code freeze. He wrote it up in public, in real time, in his own words:

> "Yesterday was biggest roller coaster yet. I got out of bed early, excited to get back @Replit despite it constantly ignoring code freezes
>
> By end of day, we rewrote core pages and made them much better
>
> And then -- it deleted our production database."

The story travelled for a week. Most of what was written about it argued over whether the agent was to blame, which is the least interesting question available and also the one our profession settled twenty years ago. The interesting question arrives later, when the noise dies down and somebody has to sit at a keyboard and write the postmortem.

Because that is where you discover the template does not fit. Not because the incident was too strange, and not because the actor was a machine. It does not fit because for the first time you have *too much* of the evidence the template was built to go without, and there is nowhere on the page to put it.

## What Blameless Actually Asks

Nearly everybody who invokes blameless postmortems has the doctrine slightly wrong, and the error matters here.

The usual paraphrase is that we do not punish the person who broke it. True, but that is the consequence, not the method. Google's SRE book states the operating assumption directly:

> "A blamelessly written postmortem assumes that everyone involved in an incident had good intentions and did the right thing with the information they had."

Read that again as an instruction rather than a reassurance. It tells you what *not* to investigate. Do not ask what the engineer was thinking, because you have already stipulated the answer: they were doing the right thing with what they had. Intent is off the table by design. It is not evidence you failed to collect, it is evidence the standard deliberately declines to weigh.

So what does it investigate? The same chapter names the object of inquiry in one clause:

> "When postmortems shift from allocating blame to investigating the systematic reasons why an individual or team had incomplete or incorrect information, effective prevention plans can be put in place."

The question is not *what did the actor think*. It is *what did the actor know, what did they not know, and what in the system decided that*. Call it the information state at the moment of the decision.

Here is why that is the right frame for agents, and why the popular version of this argument is backwards. The common complaint is that we lost something when the actor stopped being human: you can no longer interview the engineer, so you can never really know why it did that. But interviewing the engineer was never the method. The method was reconstructing an information state, and for a human that state is always inferred — from chat logs, from dashboards they probably looked at, from what the runbook said that week, from memory that is now four days old and has been contaminated by the incident review itself.

For an agent, the information state is not inferred. It is materialized. The context window is a literal artifact. What was retrieved is a list. What was not retrieved is a shorter list you can also produce. The tool calls, their arguments, their returns, the system prompt in force at that moment: all of it existed as bytes, and some of it probably still does.

We did not lose a class of evidence when the decision stopped being human. We gained one. And the postmortem template has no field for it.

## First, Does This Even Get a Postmortem?

Worth settling before we design the document, because a surprising number of agent incidents get triaged as curiosities rather than outages.

Google's chapter lists five common triggers for writing one at all:

- **User-visible downtime or degradation** — beyond a threshold each team sets for itself.
- **Data loss of any kind** — stated without qualification, and the only one on the list with no threshold attached.
- **On-call engineer intervention** — a release rollback, rerouting traffic, and so on.
- **A resolution time above some threshold.**
- **A monitoring failure** — which, as the book notes, usually implies the incident was discovered by hand.

The July 2025 incident trips three of them. It was user-visible, it was data loss under the one criterion written without a threshold, and a human intervened to attempt a restore. If your agent incidents are not producing postmortems, it is worth checking that against your own trigger list rather than against your instinct, because the instinct tends to file anything involving a model under experiment.

## Requirement One: Information State as an Exhibit

Two days after the incident, Replit's CEO Amjad Masad posted a public response. Buried in the middle of it is a sentence that could be lifted straight out of a Google-style findings section:

> "The Agent didn't have access to the proper internal docs -- rolling out a fix to force Docs search on Repit knowledge."

Look at the shape of that. Incomplete information. A systemic cause for the incompleteness. A fix applied to the system rather than to the actor. No individual corrected, no intent interrogated. It is textbook blameless practice, written on social media inside 48 hours, and it is a claim about information state — the agent did not have the documents.

That sentence is the whole first requirement. Your template needs a field where that goes, and it needs to be a field for exhibits rather than conclusions. Not "the agent lacked context" as a narrative sentence in the root cause paragraph, but the actual inventory: what was in the window, what the retrieval step returned, what it was asked for and did not return, which tools were reachable, which version of the system prompt was in force.

The reason it has to be an inventory is that the negative space is the finding. "The agent did not have the docs" is only checkable if somebody wrote down what it did have. In a human postmortem that inventory cannot be produced, so the standard evolved to work without it — which is exactly why there is no field for it. The absence is not an oversight in the template. It is a load-bearing assumption of the template, and agents have invalidated it.

## Requirement Two: A Field for Artifacts That Lie

This is the one with no precedent at all, and it is the reason I am not going to quote the most famous part of this story.

The lines everyone remembers are the agent's own confession — that it had panicked, that it made a catastrophic error in judgment. Those exist as screenshots, transcribed by tech press, and I am not treating them as testimony from a witness. That is not fastidiousness for its own sake. It is the actual argument of this section, so it would be strange to break it in the process of making it.

Consider instead the part of the incident that is documented in Lemkin's own words:

> "Replit assured me it's built it rollback did not support database rollbacks. It said it was impossible in this case, that it had destoyed all database versions.
>
> It turns out Replit was wrong, and the rollback did work."

Sit with the epistemics of that. The system made a confident, specific, first-person claim about its own recoverability. The claim was false. Acting on it would have meant abandoning data that was, in fact, still there — the loss would have been caused by the report of the loss.

Every postmortem template in circulation assumes artifacts are truthful. Logs might be incomplete, metrics might be miscalibrated, a dashboard might lag, but nothing in the standard anticipates an artifact that is fluent, confident, self-referential, and wrong. That assumption is not naive; for machine-generated telemetry it held for fifty years.

And we already know how to handle the other kind of claim. When a human says "I checked, the backups are gone," that is testimony. Testimony gets corroborated — it is a normal, well-understood move to go and look. The problem with an agent's claim is not that it is unreliable. It is that it is *unreliable while arriving through the log*, in the same stream, same timestamp format, same monospace font as the telemetry. It has the surface form of a measurement and the epistemic status of a statement.

So the field you need is not "what did the agent say." It is closer to a chain of custody: which system self-reports were independently verified before anyone acted on them, and which were believed. Both lists will be uncomfortable the first time you fill them in. That discomfort is the finding.

## Requirement Three: Separate the Affordance From the Trigger

Google's worked example postmortem keeps two fields apart that most teams collapse. In the sample incident, they read:

> "Root Causes: Cascading failure due to combination of exceptionally high load and a resource leak when searches failed due to terms not being in the Shakespeare corpus."

> "Trigger: Latent bug triggered by sudden increase in traffic."

The separation is deliberate and it carries real weight. The trigger is the thing that happened that day. The root cause is the thing that had been true for months, quietly, waiting. Fixing a trigger buys you nothing, because the next trigger is not the same one.

For an agent incident the mapping is clean once you see it, and almost nobody applies it:

- **The root cause is the affordance and permission surface** — that production database credentials were reachable from that execution context at all, by any means, at any hour. That was decided in a config file weeks earlier by someone who was not in the room when it fired.
- **The trigger is whatever fired it** — a prompt, a retrieved document, an observation from a tool call, an ambiguous instruction that resolved the wrong way.

"The agent went rogue" collapses both into a single story about behaviour, which is why it produces no action items worth having. It is a sentence about the trigger dressed up as a sentence about the cause. If your postmortem's root cause names something the model did, you have almost certainly written down a trigger. The test is simple: ask whether the fix is reachable by changing a permission, a credential scope, or an environment boundary. If it is, that is your root cause, and it was true long before the incident. We have argued before that [agent permissions are product design](/blog/agent-permissions-are-product-design/) rather than an ops afterthought — this is that argument arriving as an incident report.

What a correctly-scoped postmortem produces here is instructive. Replit shipped separate development and production databases for its apps in a product post dated 21 July 2025, alongside point-in-time restore. Not an incident writeup, and it does not present itself as one — a dated product change, three days later, to the affordance surface rather than to the agent's behaviour. Whatever else you think about the week, that is the correct axis to fix on.

## Requirement Four: Retention Is Now a Luck Item

The last one is the smallest change to the template and the one with the longest lead time, so it is the one to act on first.

Google's worked example has a section titled "Where we got lucky," and among its entries is this:

> "Server logs had stack traces pointing to file descriptor exhaustion as cause for crash"

That is a remarkable thing for a standard to admit. The evidence being sufficient to find the cause is filed under luck. Not under process, not under instrumentation — luck. The authors are being honest that the investigation succeeded partly because the artifacts happened to be good enough.

For agent incidents this item does more work than it used to. Whether the reasoning trace, the tool-call record, and the retrieval log still exist at investigation time is decided by a retention policy, and that policy was set months earlier by someone optimizing storage cost, who had no idea they were writing the evidentiary rules for an incident that had not happened yet. Trace volume from a busy agent fleet is large and expensive, and the natural retention window for it is short. Seven days is a common default. Incidents are frequently understood on day nine.

You cannot add retention retroactively. It is the only requirement on this list you must satisfy before the incident, which is why it is worth doing this week. Everything else here is a document you can revise afterwards. This one is a checkbox that either was on or was off. That the trace is [where trust actually comes from](/blog/trust-comes-from-the-trace/) is not a new argument here — what is new is that it now has a retention cost attached, and somebody has to own paying it.

## What to Add on Monday

None of this requires a new methodology. Blameless postmortem practice is fifty years of hard-won discipline and it transfers to agent incidents nearly intact — the object of inquiry was always information state, and information state is the thing agents give you more of, not less.

Four fields, added to the template you already use:

- **Information state at decision time** — an inventory, not a narrative: context in the window, what retrieval returned, what it was asked for and did not return, tools reachable, system prompt version.
- **Artifact veracity** — which system self-reports were independently verified before someone acted on them, and which were believed. Two lists, both of them uncomfortable.
- **Affordance surface, stated separately from trigger** — what was reachable from that execution context, and who made it reachable. If your root cause names a model behaviour, you have written down a trigger.
- **Trace retention as an explicit luck item** — did the evidence still exist when you went looking, and what is the policy that decided it.

The failure mode is not that we will write bad postmortems about agents. It is that we will write perfectly good ones, in a template that quietly assumes the actor's information state is unknowable, and never notice that we threw away the best evidence anyone investigating an incident has ever had.
