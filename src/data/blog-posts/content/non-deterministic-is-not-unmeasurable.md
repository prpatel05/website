Every team that ships an agent arrives at the same meeting. Someone asks why there is no regression test for the thing that broke last week. Someone else says the sentence:

"We can't really test it. The output is different every time."

That sentence gets accepted in the room, and it shouldn't. It sounds like a statement about the model. It is a statement about the test harness — specifically, about a harness that only knows how to compare one output to one expected string.

## The Blocker Is Quality, Which Is the Thing Nobody Tests

LangChain's [State of Agent Engineering](https://www.langchain.com/state-of-agent-engineering) survey put this in front of practitioners: 1,340 responses, fielded November 18 to December 2, 2025. The top barrier to getting agents into production was **quality**, named by roughly one in three respondents. Latency came second at 20%.

Worth being precise about who answered, because it changes how far the finding travels: this is a self-selected community sample, not a random panel. 63% work in the technology industry, and 49% are at organizations under 100 people. Read it as a good read on practitioner sentiment, not a census of the enterprise.

Even read narrowly, the shape of the answer is the interesting part. The number one thing standing between agents and production is not cost, not latency, not tooling. It is quality — and quality is precisely the dimension teams have decided is untestable because it doesn't reduce to an assertion.

There's a corroborating detail in the same report. At the largest organizations — 10,000-plus employees — the biggest challenge shows up as a write-in rather than a pre-set option: hallucinations and the consistency of agent output. Nobody handed those respondents "consistency" as a checkbox. They typed it in.

So the industry's top blocker is a property most teams have no instrument for. That gap is the whole problem, and it is a methodology gap, not a physics one.

## The Category Error

Non-determinism does not defeat measurement. We measure non-deterministic systems constantly and think nothing of it.

Nobody has ever said p99 latency is unmeasurable because the number is different on every request. Nobody argues that a flaky integration test suite can't be characterized because it doesn't fail the same way twice. Nobody claims conversion rate is untestable because individual users are unpredictable. In all three cases we did the obvious thing: we stopped asking about the single event and started asking about the distribution.

That is the entire move. It is not new, it is not exotic, and it is not specific to language models. The reason it feels unavailable for agents is that our testing tools were built around a hard assumption — same input, same output, assert equality — and when that assumption breaks, the tool has nothing to say. The tool going quiet is not the same as the property being unobservable.

Concretely: a test that runs your agent once and asserts on the result is not a bad test of a stochastic system. It is a **sample of size one**, reported as a fact. If you ran your latency benchmark once and shipped the number, you'd be embarrassed. That is what a single-run agent eval is.

## Assertions Become Distributions

Here's what the harness looks like when you stop fighting the shape of the system.

**Run it n times, not once.** The unit of measurement is a batch, not an invocation. Ten runs of the same input tells you something one run structurally cannot: whether the failure you saw is a coin flip or a floor. This alone converts most "we can't test it" cases into "we can test it, it just costs more than we assumed."

**Report a rate, not a verdict.** The output of an eval is `47 of 50 passed`, not `PASS`. A rate carries information a boolean throws away — where you are, and how much headroom there is before the next regression becomes visible.

**Set the threshold above zero.** A 100% pass bar on a stochastic system means your suite goes red on noise, everyone learns to re-run it, and within two weeks the suite means nothing. Pick a bar you can actually hold — 90%, 95%, whatever the task warrants — and treat *drops* as the signal.

**Compare runs, don't grade them.** This is the one that matters most for regressions, and it's the one teams skip. You usually don't need to know whether your agent is good in the abstract. You need to know whether today's build is worse than last week's. That's a two-sample comparison between two batches, and it is a far easier question than absolute correctness. It also sidesteps the hardest part of eval design, which is agreeing on what "correct" means for open-ended output.

**Fix your seeds where you can, and know where you can't.** Temperature, tool ordering, retrieved context, and model version are all inputs. Pin the ones you control, log the ones you don't, and stop being surprised when an unpinned input moves the distribution.

## What You Assert On When There's No Expected String

The second objection follows immediately: fine, run it fifty times — pass according to *what*?

Not string equality. That was never the right check even when it was technically possible, because there are a thousand correct ways to write a good summary and your golden output is one of them. What you assert on are **invariants** — properties that must hold for every acceptable answer, however it's phrased:

- **Structural.** Valid JSON. Required fields present. Enum values in range. Cheap, deterministic, and catches more real breakage than anyone expects.
- **Grounding.** Every factual claim traces to something in the provided context. This is checkable without knowing the right answer, which is what makes it powerful.
- **Constraint adherence.** It didn't touch the table you told it not to touch. It didn't call the write endpoint in a read-only run. It stayed under the step budget.
- **Behavioral.** Given a deliberately ambiguous input, does it ask, or does it guess? A silent guess is a failure mode with no artifact attached, and it is the one that [fails quietly](/blog/agents-fail-quietly/) in production.
- **Relative.** Judged head-to-head against the previous build's output, which is a much more reliable judgment — for a human or a model — than an absolute score on a ten-point scale.

Notice how many of these are ordinary deterministic assertions. The output is stochastic; most of the properties you care about are not. Once you stop demanding the *whole output* be predictable, a surprising amount of it turns out to be.

None of this makes your suite a source of truth about quality. It makes it an instrument that moves when the system moves — which is all a regression test ever was. If you want the harder question of whether your checks are checking the right things, that's [a different failure mode](/blog/your-eval-suite-measures-the-wrong-thing/), and it's worth its own look.

## The Honest Part

Two things I'd rather say than have you discover.

**This costs more.** Fifty runs is fifty times the tokens and fifty times the wall-clock. That's real, and it's the actual reason most teams don't do it — the intellectual objection is usually a budget objection wearing a lab coat. The good news is the tradeoff is tunable: a small n on every commit to catch the loud regressions, a large n nightly on the cases that matter.

**Small samples lie.** Ten runs cannot distinguish a 90% pass rate from a 75% one with any confidence, and a batch that goes 48/50 to 45/50 has probably told you nothing. If you're going to report rates, report them with enough n to mean something, and resist the urge to open an incident over a three-point move. Treating noise as signal is its own way of making a suite worthless — the failure mode is the mirror image of the 100% bar, and it arrives faster.

## Where This Leaves the Meeting

The next time someone says you can't write a regression test for it, the useful reply isn't that they're wrong. It's a question: *what would we have to be able to measure for this to be testable?*

The answers come back concrete every time. We'd need to run it more than once. We'd need to agree what a good answer has to contain, rather than what it has to say. We'd need somewhere to put the number so we can watch it move.

That's a backlog. It's not a wall.

We've [written before](/blog/ai-made-bugs-cheap-to-find/) about how cheap it has become to find bugs, and this is the same argument pointed at a harder target. The thing standing between your agent and production is the top blocker in the survey, it's the thing your largest customers type in by hand when the checkboxes don't cover it, and it's the thing you have decided not to instrument because the output is different every time.

The output being different every time is not the obstacle. It's the measurement.
