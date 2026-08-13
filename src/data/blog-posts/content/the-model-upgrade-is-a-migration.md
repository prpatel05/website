On August 5, 2026, `claude-opus-4-1-20250805` stopped answering. Not degraded, not slower, not quietly swapped for something newer. Retired. Requests to it fail.

If you were still calling that model on August 6, you had two months of warning and a documented replacement, and none of that helped, because nobody on your team owned the date.

Here is the part worth sitting with: the people most likely to have been caught are the ones who did the responsible-sounding thing. They pinned a specific model version so their outputs would stay stable. Pinning is good practice. It is also the thing that turns a gradual quality drift into a hard outage on a day somebody else chose.

## The Notice Period Has a Floor, and the Floor Became the Ceiling

Anthropic's [model deprecations page](https://platform.claude.com/docs/en/about-claude/model-deprecations) states the commitment plainly: "Anthropic notifies customers with active deployments for models with upcoming retirements, providing at least 60 days' notice before model retirement for publicly released models."

That sentence has not changed. What has changed is what it means in practice.

The same page publishes a full deprecation history: every announcement, and the retirement date it carried. Do the arithmetic on the gap between the two, oldest first:

- **September 4, 2024** to November 6, 2024 — 63 days, for the Claude 1 and Instant models
- **January 21, 2025** to July 21, 2025 — 181 days, for Claude 2, 2.1 and Sonnet 3
- **June 30, 2025** to January 5, 2026 — 189 days, for Opus 3
- **August 13, 2025** to October 28, 2025 — 76 days, for the Sonnet 3.5 models
- **October 28, 2025** to February 19, 2026 — 114 days, for Sonnet 3.7
- **December 19, 2025** to February 19, 2026 — 62 days, for Haiku 3.5
- **February 19, 2026** to April 20, 2026 — 60 days, for Haiku 3
- **April 14, 2026** to June 15, 2026 — 62 days, for Sonnet 4 and Opus 4
- **June 5, 2026** to August 5, 2026 — 61 days, for Opus 4.1

Read the last four numbers: 62, 60, 62, 61. Now read the five before them: 63, 181, 189, 76, 114.

The stated policy is a minimum, and for a while the practice was far more generous than the minimum. It is not anymore. The floor became the ceiling, and it did so without any announcement, because nothing was announced — the policy sentence is the same sentence it always was.

Be precise about what this is. Those day counts are my arithmetic on their published dates, not a figure Anthropic reports. And it describes what has happened, not a promise about what happens next. A vendor that has given 60 days four times running is not contractually barred from giving 200 next time. But if you are sizing a migration off what you remember from 2025, you are budgeting with a number the vendor stopped giving out.

Sixty days is the planning input. Assume it.

## Pinning Is a Deferral, Not a Fix

The instinct when a new model lands is to pin the old one and deal with it later. It buys real things: stable outputs, no re-tuned prompts, no surprise regressions in the middle of a quarter.

What it does not buy is an exit. The deprecations page is unambiguous about the end state: "Requests to models past the retirement date will fail." Pinning converts an open-ended quality question into a dated availability question. The work does not go away; it gets scheduled by someone outside your company.

That is a trade worth making deliberately and almost never worth making by default. If you pin, the pin needs an expiry in your own tracker, not just in the vendor's.

## The Parameter You Have Used for Years Can Become an Error

Here is the part that surprises people, because it is not about swapping a model string.

The same page carries an API parameter deprecation table. For `temperature`, `top_p` and `top_k`, the status is "Deprecated (Claude Opus 4.7 and later)" and the documented behavior is that the parameter "Returns a 400 error when set to a non-default value on Claude 4.7 and later models."

Sit with that. These are not exotic flags. `temperature` is in the first example of nearly every tutorial ever written against this API. Code that has worked untouched for two years can start returning a 400 — not because the model got worse at the task, but because the request shape is no longer accepted. Your migration is not "does the new model still do the job." It is also "does my request still parse."

And this is where pinning stops being merely a deferral and starts being a trap. Pinning holds your request shape valid right up until the pinned model retires, at which point you have to move to a model that rejects the request you have been sending. The reckoning arrives all at once, on the retirement date, rather than incrementally while you had slack.

One honest caveat, because it changes what you should do about it. Anthropic's migration guide describes this more strongly than the deprecation table does — it says to remove the parameters from request payloads entirely, while the deprecation table specifies a 400 only on a non-default value. Those are not the same rule, and I am not going to pretend to know which one your account will enforce today. When two documents from the same vendor disagree about the shape of your request, the answer is not to reason it out. It is to send one request and read the response. Which is itself the point: this is an operations question, not a reading-comprehension question.

## Your Deadline Depends on Where You Bought

One more line from that page, easy to skim past and expensive to miss: the dates apply to Anthropic-operated platforms, and "Partner-operated platforms (Amazon Bedrock and Google Cloud) set their own retirement schedules, so a model's lifecycle status and dates can differ."

So "when does this model retire" has no single answer across a fleet. The same model ID, serving the same workload, can have two different death dates because two teams bought through two different clouds. If your inventory tracks models but not the platform each one is called through, your inventory cannot answer the only question that matters.

## Treat It Like a Migration, Because It Is One

We already know how to do this. It is a dependency upgrade with a hard deadline set by someone else, and the discipline is the same discipline.

- **Keep an inventory keyed by model ID and platform.** Not "we use Claude." Which model string, called from which service, through which provider, owned by whom. Anthropic's console exports usage broken down by API key and model precisely so you can build this; the page walks through it.
- **Give every pin an expiry date in your tracker.** A pinned version with no scheduled review is a deferred outage. The vendor's retirement date is the deadline, not the start.
- **Rehearse the upgrade before you are forced into it.** Run the new model against your real workload while the old one still works, so you can compare rather than guess. This is exactly the moment a real evaluation suite earns its cost, and the moment you discover whether yours [measures the thing you actually care about](/blog/your-eval-suite-measures-the-wrong-thing/).
- **Test the request shape, not just the output quality.** Deprecated parameters, changed defaults, and removed options fail differently from a model that is merely worse. A 400 is not a regression; it is a build break.
- **Write down what you learned last time.** The migration you just finished is the runbook for the next one, and there will be a next one on roughly this cadence. [A runbook beats a better prompt](/blog/agent-runbooks-beat-better-prompts/) here for the same reason it does everywhere else: the knowledge outlives the person who has it.

The failure mode to avoid is the one that already bit people on August 5. Not ignorance — the email went out, the docs were updated, the replacement was named. The failure was that the information arrived in an inbox and never became a dated task with an owner. An agent that stops answering in production [fails about as quietly as one that keeps answering wrongly](/blog/agents-fail-quietly/), and both of them start with nobody holding the calendar.

## The Vendor Is Not Pretending This Is Free

The last thing on that page is the part I did not expect to find there.

Anthropic writes that it "currently deprecates and retires models to ensure capacity for new model releases," and then lists the downsides in its own words: users who value specific models must migrate, researchers lose access to models for ongoing and comparative studies, and "model retirement introduces safety- and model welfare-related risks." It commits to long-term preservation of model weights, and says it hopes to make past models publicly available again at some point.

That is a more candid account of the cost than a vendor is obliged to give, and it is worth reading as what it is: an acknowledgment that retirement is a real loss, not a routine version bump.

It is also not a reprieve. Preserved weights are not a served endpoint. The commitment is about the long-term record, and your code needs to run on Tuesday. Sixty days, a named owner, and a date on the calendar.
