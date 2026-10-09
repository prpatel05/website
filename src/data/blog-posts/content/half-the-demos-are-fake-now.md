In September I posted that I had built a trading bot and let it run BTC for 30 days. The next line was the point: "jk. $0 in. just generated the video. half these posts are fake." It did 8,889 impressions, more than anything else I had posted in weeks. No bot. No trades. No thirty days. Just a generated clip that looked exactly like the ones people were posting for real.

The reason it landed is that everyone in the replies already suspected it. The same month, a widely shared post claimed an agent had built a 3D shooter, and it got called out as generated video footage. My reply to that one was five words: the agent shipped a trailer. That was not a joke about one account. It was a description of the genre.

Here is the inversion. A demo used to be expensive enough to count as weak evidence: if you could show it working, you had probably built most of it. That is over. Producing a convincing AI demo now costs less than building the thing it depicts, so a demo proves nothing on its own. The only proof that still counts is a run someone other than you can replay.

## A Demo Is Now Cheaper to Fake Than to Build

Think about what a working demo used to cost. You needed the feature, an environment it ran in, data that did not embarrass you, and enough reliability to get through one take. The demo was a byproduct of the work, so seeing it told you the work existed.

Each of those inputs is now optional. Video models will render a terminal scrolling through a plausible agent run. A screen recording can be cut from forty takes down to the one that worked. A "live" demo can run against a staged account with the edge cases removed. None of this requires the underlying system to exist, or to work more than once.

When the cost of the fake drops below the cost of the real thing, the market fills with fakes. Not because everyone is lying, but because the honest version and the dishonest version now look identical in a sixty second clip, and the dishonest one is cheaper to make. The viewer cannot tell them apart, so the clip stops carrying information. It is not evidence anymore. It is an ad.

## Every Demo Hides a Person You Stopped Counting

Even the honest demos have a problem, and it is subtler than generated video. In August I wrote: "The demo that works has a person you stopped counting. Someone is watching the screen, catching the bad step, and calling it the agent. Take that person out and you have the real success rate."

This is the most common fake, and the person running it usually does not know they are faking anything. They restart the run when it wanders. They nudge the prompt when the first tool call misses. They pick the input they know works. By the end, the recording shows an autonomous agent completing a task, and it hides the human who made four quiet corrections along the way.

The gap shows up the first time someone else runs it. The demo was a success rate of one, with a hidden operator. Prod is a success rate across every input, with no operator at all. If it only works while you are in the room, it does not work. It is a performance.

## Confidence Is Not Evidence, Even for the People Who Built It

You might think this is a marketing problem, and that engineers who ship the code see through it. The numbers say otherwise.

SmartBear's [2026 State of Software Quality and Testing](https://smartbear.com/news/news-releases/state-of-software-quality-testing-2026/) surveyed 1,436 people who use AI in development. 46% said their teams had shipped AI code that later failed in production. Of those teams, 69% still had a lot or complete confidence that AI-written code behaves as intended.

Read that as a statement about evidence. These are teams that watched the code fail in prod, and most of them kept believing in it anyway. Confidence survived contact with the failure. If that is how the people closest to the code reason, it is not surprising that a polished clip moves an audience further than it should. Belief is cheap. It does not update unless something forces it to.

The fix is not more skepticism, applied by hand, to every post you scroll past. It is changing what counts as a claim. A claim without a receipt is a feeling, however confident it sounds.

## A Receipt Is a Run Someone Else Can Replay

This is the mechanism. A demo shows that something happened once, on your machine, under your supervision. A receipt lets someone who is not you make it happen again and see the same result, or see it fail.

That is different from what I covered in [Trust Comes From the Trace](/blog/trust-comes-from-the-trace/). A trace is observability inside a run: the causal record you use to understand why your own agent did something surprising. A receipt is about the public claim. It is what you hand a stranger so they do not have to take your word for anything.

A receipt worth the name has four parts:

**The inputs.** The actual task, data, and configuration, not a description of them. If the input was chosen because it was the one that worked, the receipt should say so.

**The unedited run.** The whole thing, including the wandering, the retries, and the step where it got stuck. If a human intervened, the intervention is in the record, with a count.

**The cost and the limits.** Tokens, dollars, wall clock time, and the point where the run stopped and why. A rate limit is a result. So is a usage cap.

**The failure rate.** Not the best run. The distribution: how many attempts, how many succeeded unassisted, what the failures looked like.

The test for all four is the same: could someone who dislikes you rerun it and get a comparable number? If yes, you have a receipt. If the answer depends on trusting the narrator, you have a demo.

This is unglamorous. Receipts are long and boring and less impressive than the clip. That is the point. The boring parts are the parts that are expensive to fake.

## A 24/7 Claim Has to Survive Minute 48

Here is the worked example. In September I posted a two-line joke:

"24/7 trading agent"
"usage limit in 47 minutes"

The joke is the whole argument in miniature. The claim is about duration and autonomy. The reality is a quota. A demo of a "24/7 trading agent" is a clip of the agent placing a trade, which proves the agent can place a trade. It says nothing about hour two, let alone day thirty.

Now rewrite the same claim as a receipt.

The inputs: the strategy configuration and the market data window, published so anyone can point the same agent at a paper trading account. The run: the full log from start to stop, not a highlight, with timestamps. The cost and the limits: tokens consumed per hour, the plan tier it ran on, and the honest line that the run halted at minute 47 when the usage limit hit. The failure rate: how many sessions were attempted, how many ran unattended past one hour, how many needed a human to restart them, and what the P&L looked like after fees across all of them, not the best one.

That receipt might be embarrassing. It might show an agent that trades well for forty-seven minutes and then stops. Fine. That is a real, bounded, inspectable result, and it is more useful to a reader than any clip, because it tells them what they would actually get. It also gives the builder something to fix. "It hits the limit at 47 minutes" is a contract problem you can work on. "It runs 24/7" is a slogan nobody can check.

The demo says the thing works. The receipt says how often, for how long, at what cost, and with how much help. Only one of those survives someone else trying it.

## The Bottom Line

When a convincing demo costs less than the product, the demo stops being proof of the product.

A demo shows that it worked for you once. A receipt lets anyone else find out if it works at all.
