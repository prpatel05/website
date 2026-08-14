Anthropic's model deprecation page has a section that reads like a museum plaque.

Under the heading for September 4, 2024, it says: "On September 4, 2024, Anthropic notified developers using Claude 1 and Instant models of their upcoming retirements." A note above it adds that those models were retired on November 6, 2024. Everything in the framing says *closed*. Past tense, two dates that have both long since passed, a decision that finished executing before most people reading it had written a line of code against this API.

Then look at the third column. The recommended replacement listed for `claude-1.0` is `claude-haiku-4-5-20251001`.

Read that model ID carefully. Anthropic stamps the release date into the string, and this one says October 1, 2025 — more than a year *after* the announcement it is sitting inside. A row dated September 2024 is recommending a model that would not exist for another thirteen months.

Nothing here is wrong. The page is doing you a favour: if you arrive today looking for what to do about `claude-1.0`, a 2024-era answer would be useless. So the column gets maintained.

But notice what that means. The section is presented as history and one of its columns is live. It is a document that keeps changing while continuing to describe itself as a record of something that already happened.

Which is fine, right up until you make a copy of it.

## The Runbook Is a Copy of Something Still Being Edited

Here is how the failure actually happens, and it is boring, which is why it works.

Someone competent hits a model retirement. They do the migration properly, and then they do the thing we all agree is good practice: they write it down. Inventory of every model string in the fleet. Which service calls which. Who owns each one. What we moved to last time and why. The document is accurate, useful, and it saves the next person a week.

Eighteen months later that document is still accurate in every respect a reader can check. The model IDs in it are real model IDs. The links resolve. The procedure runs. Nobody has flagged it as out of date, because nothing in it looks out of date.

And it is now recommending a migration target that has itself been deprecated.

This is a different failure from the one where documentation goes missing or obviously rots. A stale link 404s. A dead procedure throws. Those announce themselves. The runbook failure is quieter: the artifact stays valid, keeps passing every check anyone thinks to run on it, and stops being true without changing a single character.

## The Vendor Describes This Exactly, in a Sentence About Type-Checking

The clearest statement of the problem I have found is on that same deprecation page, in a section about API parameters rather than documentation.

"Deprecated parameters remain in the SDK request types so existing code continues to type-check, but their behavior changes per model."

Sit with the shape of that sentence, because it is not really about parameters.

Something continues to pass its checks. The checks are real checks — a type checker is not a formality, and code that type-checks against an SDK has genuinely proven something. It has proven the shape is right. It has proven nothing at all about whether the meaning is still the same, because meaning was never in scope for the check.

That is a runbook. It passes every check available to it. It is well-formed, it names real things, its steps are executable in order. What it cannot do is notice that the world it describes has moved, and no check you can cheaply run on the document will notice either.

There is a companion piece to this one in the archive, written a few weeks earlier, about the operational side of these retirements — the calendar, the notice periods, and what pinning a model version actually buys you. That one is about the deadline you did not put on your own calendar. This one is about the answer you wrote down and then trusted for longer than it was good for.

## The Replacement Target Is Also on the Clock

The sharpest version of this is sitting in two different tables on the same page, and it only shows up if you read both.

On February 19, 2026, Claude Haiku 3 was deprecated, with a retirement date of April 20, 2026 and a recommended replacement of `claude-haiku-4-5-20251001`. Follow the instruction and you land on Haiku 4.5. Good outcome. Write it down: when Haiku 3 goes, move to `claude-haiku-4-5-20251001`.

Now read the model status table further up the same page. `claude-haiku-4-5-20251001` is listed as Active, with a tentative retirement date of "Not sooner than October 15, 2026."

You are reading this in November 2026. That floor is behind us. Go and check what the page says today — I am deliberately not telling you, because the point is that I cannot. I am writing this in advance, which is exactly the position your runbook is in relative to its reader.

A runbook that says "migrate to X" begins aging on the day it is written, and it ages against a clock that is not in the document. The instruction was correct. It is going to stay correct-looking long after it stops being correct.

## Separate What You Know From Where You Looked

The fix is not "review your docs quarterly." Everyone says that, nobody sustains it, and it does not survive contact with a real quarter.

The fix is structural: a runbook contains two kinds of statement, they decay at completely different rates, and most runbooks mix them together on the same page with the same formatting.

- **Facts about the world are perishable.** *The replacement for Haiku 3 is `claude-haiku-4-5-20251001`.* *We give sixty days of notice.* *This parameter is accepted.* Every one of these was true when written, and every one has a half-life set by someone outside your company.
- **Procedures that resolve a fact are durable.** *To find which models we are actually calling, export usage from the console and group by API key and model.* That sentence does not go stale. It does not name a model, a date, or a version. It tells you how to get today's answer, and it will still tell you that when every model in this post has been retired.
- **Decisions with their reasoning attached are durable in a third way.** *We pinned this version because output stability mattered more than latency for this workload.* The conclusion may expire. The reasoning is what lets the next person tell whether it has.

Anthropic's page happens to contain a clean example of the durable kind. It walks through auditing your own usage: go to the Usage page in the console, click Export, and review the CSV to see usage broken down by API key and model. That procedure has no expiry. It is not a claim about the world — it is an instruction for interrogating the world, and the world answers freshly every time you run it.

Most of what people put in runbooks is the perishable kind, because the perishable kind is what you know at the moment you finish the migration and sit down to write.

## Write the Lookup, Not the Answer

Concretely, three habits that cost nothing at authoring time.

1. **Name the source next to every borrowed fact.** Not as a citation — as an expiry mechanism. "Replacement is `claude-haiku-4-5-20251001` (per the deprecations page, read 2026-02-19)." A fact with a date and a source attached tells the next reader how much to trust it. A bare fact claims to be eternal.
2. **Prefer the query to the result.** Where you can write either "we call these four models" or "here is how to list the models we call," write the second. It is a worse sentence and a better runbook. Do the first as well if you like, but mark it as a snapshot.
3. **Put the dates that matter on a calendar, not in prose.** A retirement date inside a document is a fact that will quietly pass. The same date in a tracker with an owner is a thing that goes off. The document should tell you where the dates come from; something with an alarm should hold them.

None of this is new. It is the same instinct behind [preferring a runbook to a better prompt](/blog/agent-runbooks-beat-better-prompts/) in the first place: write down the thing that generalises, not the thing that happened to work once. The wrinkle is that a runbook can fail this test in its own way, by capturing an answer where it should have captured a method.

## The Title Is Not a Compliment

"The runbook outlives the model" sounds like a good property. Institutional knowledge surviving the thing it was about — that is the whole argument for writing anything down.

But outliving is only useful if the document knows it has. Ours do not. They keep their tone. A runbook written in 2026 still reads, in 2028, like current operating guidance from a colleague who knew what they were doing, because that is exactly what it was. The confidence in the prose was earned once and it never expires, even though everything the prose asserts eventually does.

So the thing to write down is not what you learned. It is how you found out.

The model you are running today has a retirement date. It may already be published; it may still be a floor with "not sooner than" in front of it. Either way there is a document somewhere in your company that will still be describing your current setup in the present tense long after none of it is true, and it will not look wrong on the day it stops being right.

Go and read it. Not to check whether it is accurate — to check how much of it is a fact you copied rather than a question you left instructions for.
