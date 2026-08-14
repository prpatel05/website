Anthropic's pricing page carries a worked example. It is there to make the abstraction concrete, and it does the job well:

> "Example calculation for processing 10,000 support tickets: Average ~3,700 tokens per conversation • Using Claude Haiku 4.5 at $1/MTok input, $5/MTok output • Total cost: ~$37.00 per 10,000 tickets"

Thirty-seven dollars to handle ten thousand support tickets. That is a real number, computed honestly, and if you are trying to decide whether this is worth building it tells you something true.

Directly beneath it, the page offers to show its work: *"For a detailed walkthrough of this calculation, see the customer support agent guide."* So open the guide the pricing page just nominated. It defines the metric the system is supposed to be judged on:

> "Deflection rate: The percentage of customer inquiries successfully handled by the chatbot without human intervention. Typically aim for 70-80% deflection rate, depending on the complexity of inquiries."

Read those two documents next to each other. The $37.00 is computed across all 10,000 tickets. The guide the pricing page links to expects somewhere between 2,000 and 3,000 of them not to land.

The number is not wrong. The arithmetic is fine, and 70-80% is a target the guide states as a goal, not a measurement anybody took. But it is the bill for the first try. The second try has no line in it — and the second try is not the exception here, it is a fifth to a quarter of the work.

## What Retrying Actually Costs

I want to be careful about the difference between a plausible worry and a measured one, so here is the measured one.

Kapoor, Stroebl, Siegel, Nadgir and Narayanan built a benchmark study of coding agents and did something the underlying papers had not: they put accuracy and dollars on the same row. Their Table A1 caption states the method plainly.

> "Accuracy and total cost of HumanEval agents. We run each agent five times and report the mean accuracy and the mean total cost on the 164 HumanEval problems. The minimum and maximum values are included in the parentheses."

Five runs, one benchmark, printed ranges. Two rows carry the argument:

- **LATS (GPT-4)** — 88.0 accuracy (82.3-91.5), total cost 134.50 (123.98-147.13).
- **Retry (GPT-4)** — 92.0 accuracy (91.4-92.7), total cost 2.51 (2.46-2.56).

The elaborate search agent scored four accuracy points *worse* than the baseline, for roughly fifty-four times the money. And the baseline that beat it is literally named "Retry" — its whole strategy is to run the thing again.

Those dollar figures are from April 2024, priced against a model that cost $10 per million input tokens and $30 per million output tokens at the time. I am not quoting them as today's costs and neither should you. The authors saw that objection coming and answered it in the same breath as the finding:

> "Agents differ drastically in terms of cost. For substantially similar accuracy, the cost can differ by almost two orders of magnitude. Yet, the cost of running these agents isn't a top-line metric reported in any of these papers."

And then, defending the shelf life of their own numbers:

> "...over 50 times more (all these costs are entirely or predominantly from calls to GPT-4, so these ratios will be stable even if model costs change)."

That parenthetical is why a two-year-old table still earns its place. Use the ratio, not the absolute. The ratio is the finding.

## Why More Tries Stop Paying

If retrying is that cheap, the obvious move is to retry harder. There is a number for what that buys, and it comes from the paper that introduced the metric everybody now quotes.

The Codex paper's Table 1 reports pass@k on HumanEval, where k is how many samples you draw per problem. For the largest model in the suite:

- **Codex-12B at k = 1** — 28.81%.
- **Codex-12B at k = 10** — 46.81%.
- **Codex-12B at k = 100** — 72.31%.

A hundred times the attempts buys about two and a half times the solve rate. That is the shape of the curve, and it is worth internalising before you budget: the tries are cheap individually and they stop paying long before they stop costing. The paper also notes that the sampling temperature should be tuned to the particular k you are targeting, so these columns are not one configuration with a dial turned up.

But the number that actually matters for an operator is not in the table. It is in the sentence next to it, and it quietly disqualifies most of what people do with pass@k:

> "Pass@k can also be interpreted as the result of evaluating the best out of k samples, where the best sample is picked by an oracle with prior knowledge of the unit tests. From a practical perspective, we are also interested in the setting where we must select a single sample from k samples without having access to an oracle."

There it is. 72.31% is what you get when something already knows which of the hundred answers is right.

## The Oracle Is the Whole Problem

HumanEval has unit tests. That is what makes it a benchmark: correctness is free, instant and total. Draw a hundred samples, run the tests, keep the winner, and the other ninety-nine cost you nothing but tokens.

Now price the same strategy against the work you actually run an agent on. A refund is issued. An email goes out. A row is written. A ticket is closed as resolved. For each of those, ask the two questions the oracle answers for free on a benchmark:

- **Did the attempt succeed?** For a coding problem, the test suite says so in milliseconds. For a support conversation, you find out when the customer comes back angry, or when nobody audits it and you never find out at all.
- **Can you discard the failures?** The ninety-nine wrong HumanEval samples evaporate. Ninety-nine wrong emails have been sent.

This is the actual asymmetry, and it is not a token-pricing problem. Retry economics are borrowed wholesale from a setting with a free verifier and applied to a setting with no verifier and no undo. That is the same fault line I wrote about in [giving your agent an undo button](/blog/give-your-agent-an-undo-button/), arriving from the direction of the invoice instead of the direction of the incident.

So the honest budget line is not "tokens times attempts." It is tokens times attempts, plus the cost of deciding which attempt worked, plus the cost of the attempts you cannot take back. The middle term is the one nobody prices, and on most real workloads it is a human being reading something.

## Three Budget Lines That Are Not in the Price Table

While you are re-reading the pricing page with retries in mind, three things on it are worth pointing at directly. None of them are hidden. All three are invisible if you budget by multiplying a per-token rate by a volume.

A price rise that never touches the price. The page notes:

> "Claude 4.7 and later models and Claude Mythos Preview use a newer tokenizer that contributes to their improved performance on a wide range of tasks. This tokenizer produces approximately 30% more tokens for the same text. The exact increase depends on the content and workload shape."

Opus 4.6 and Opus 4.7 are both listed at $5 per million input tokens and $25 per million output. Same rate, roughly 30% more tokens for the same text. Your per-task cost moves and the price table does not, which is exactly the kind of budget you did not know you had.

A clock, not just a meter. Managed Agents bills session runtime at $0.08 per session-hour, metered on *"`running` status duration"* — the page specifies that runtime *"accrues only while the session's status is `running`"* and that idle time does not count. That is a fair way to meter it. It also means a second attempt is a second session-hour on a SKU that is not per-token at all, so the retry shows up on a line your token math never touches.

A floor under every attempt. The code execution tool is billed by execution time, and the page states that *"Execution time has a minimum of 5 minutes"* (at $0.05 per hour per container, after 1,550 free hours per organisation per month). A retry that fails in four seconds is billed as five minutes. Cheap in absolute terms, and structurally the point: the failed attempt has a floor, and the floor does not care that it failed early.

## Budget the Second Try on Purpose

The fix is not to retry less. Retry is the cheapest thing in that table and it beat the clever agent outright.

The fix is to stop treating the second try as an exception and start treating it as a line item.

Start with the strategy that is already in the data. The same study includes a baseline called Escalation, which begins on a cheap model and moves up only when the cheap one fails: 85.0 accuracy (84.1-85.4) at a total cost of 0.27 (0.25-0.28) — about a tenth of what the flat GPT-4 retry baseline spent, for seven accuracy points less. That is a legible trade, and it is legible precisely because the failure path was designed rather than discovered.

Three things to change on Monday:

1. Quote cost per resolved unit, never cost per attempt. If your deflection target is 75%, your real per-ticket cost is the modelled cost divided by 0.75, plus whatever the other 25% costs to route to a human. A number that assumes every attempt lands is not a forecast, it is a floor.
2. Name your oracle before you raise your retry count. Write down the thing that decides an attempt succeeded, and what it costs per invocation. If the answer is "a person reads it," you have just found the dominant term in your budget, and more retries make it bigger, not smaller. If there is no oracle at all, extra attempts are not buying you the pass@k curve — they are just spending.
3. Meter the failures separately. Cost, attempts and wall-clock on the paths that did not resolve, reported next to the ones that did. If your dashboard cannot answer "what did we spend on work that did not land last month," the second try is being paid for out of a budget nobody is reading.

None of this requires new infrastructure. It requires the reporting line that the research literature was missing too, which is the part I keep coming back to: the cost of the attempts that failed is not an advanced metric, it is the [thing your eval suite is not measuring](/blog/your-eval-suite-measures-the-wrong-thing/).

Every price you have been quoted — per token, per task, per session-hour — is quoted for the attempt that works. The operational cost of an agent is set almost entirely by the attempts that do not, and the retry is only ever as cheap as the thing that tells you which attempt worked.
