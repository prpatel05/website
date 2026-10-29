Somewhere this quarter, an engineering manager is looking at two lines in a budget. One is an open junior req that has been sitting unfilled since spring. The other is a top-tier coding agent plan at roughly $200 a month. The plan is a rounding error next to a junior's fully loaded cost in any market. It does not need onboarding. It closed eleven tickets last week. The req quietly gets pushed to next year, and nobody writes that decision down, because it does not feel like a decision.

The usual framing is that this is a replacement story: the agent does the junior's job, so the junior job goes away. I think that framing is half right in a way that makes it dangerous. The plan really does replace a large share of what juniors did all day. That part is not hype. What it does not replace is the reason most good teams hired juniors in the first place.

Here is the inversion. A junior hire was never one purchase. It was two, bundled together so tightly that we stopped seeing the seam. The $200 plan unbundles them. It sells you the first one at a fraction of the price and none of the second, and the teams that treat it as a straight swap will not notice what they stopped buying for about five years.

## A Junior Hire Was Always Two Purchases

The first purchase was throughput on bounded work. Tickets with a clear definition of done. Glue code between two services that already existed. Tests for a module someone senior wrote in a hurry. The migration nobody wanted: rename the field, update forty call sites, fix what breaks. Unglamorous, checkable, necessary work that a senior could do faster but should not be doing at all.

The second purchase was an option on a future senior engineer. You paid full price for the throughput, knowing it was slower and buggier than it would be from someone experienced, because the person doing it was absorbing the system. Every migration taught them where the bodies were buried. Every review comment taught them what the team cared about. Every incident they sat in on taught them what failure looks like from the inside. In three to five years, if it went well, you had someone who knew your codebase better than any hire you could make from outside, and who had judgment shaped by your actual problems.

Most teams never priced these separately, because they never had to. You could not buy the throughput without also buying the option. The option was the expensive, slow, uncertain part, and it was where most of the value eventually came from.

## The Plan Buys the Output and Skips the Option

A $200 plan is very good at the first purchase. Hand it a well-scoped ticket and it will produce a working diff, with tests, faster than a junior and often cleaner. It does glue code without complaining. It will do the forty call site migration at two in the morning. On the narrow measure of bounded work delivered per dollar, the comparison is not close, and pretending otherwise is how you lose credibility with anyone who has actually used one.

What it does not do is accumulate. Each session starts close to zero on your history. It does not remember why the billing retry logic is weird, or that the last person who simplified it caused a double charge. It does not build a sense of which reviewers care about what. It gets better when the vendor ships a better model, not because it spent a year inside your system. Its improvement curve belongs to someone else.

And it does not own anything. A junior who ships a migration that breaks on Friday feels it. They are in the incident channel. They learn what it costs. The plan produces the same broken migration with the same confidence and has no stake in the outcome at all. The owner is whoever approved the PR. If nobody was clearly assigned that seat, the owner is nobody, which is the most expensive possible answer.

So the real trade is not "agent or junior." It is: you can now buy the throughput without the option. That is genuinely useful. It is also a trap, because the option was the part that compounded, and it is the part that disappears silently. Nothing breaks the year you stop hiring juniors. Things break the year you need a senior who knows your system and there is no one in the pipeline. I covered what the early data does and does not say about this in [The Entry-Level Job Is the Canary](/blog/the-entry-level-job-is-the-canary/). This post is about what to do inside a team, on a Tuesday, with the plan already paid for.

## A Worked Ticket: Fourteen Call Sites and One Strange Retry

Here is a ticket shaped like ones every team has.

Move the notification service off an old queue client and onto the new one the platform team supports. Fourteen call sites. The new client has a different retry API. Done means all fourteen call sites use the new client, tests pass, the old dependency is removed.

Give it to the plan. In an afternoon you get a clean PR. All fourteen sites migrated, the old dependency gone, tests green. Thirteen of the call sites retried once on failure. One retried five times with a long backoff. The plan, reasonably, normalized it to match the others, because the new client's defaults make that the natural shape and nothing in the ticket said otherwise. The description even notes it as a small cleanup.

That fifth retry was there for a reason. Years ago, one downstream provider rate-limited bursts and silently dropped messages instead of returning errors, and someone fixed it by making that one call site patient. There is no test for it, because the failure only shows up under real traffic. The comment that explained it was deleted in an earlier refactor. The PR is correct by every check you have and wrong in the one place that matters.

Now give the same ticket to a junior. They are slower. Their first PR has a bug in the error handling. But somewhere around call site nine, they notice that one retry block looks different from all the others and they ask about it in the team channel. Someone senior remembers the provider. The retry stays. The junior writes the comment back in. And now there is one more person on the team who knows that provider is fragile, which will matter the next time it misbehaves at an inconvenient hour.

That question was the junior's real output. Not the diff. The plan did not fail to answer it. It never had a reason to ask it, because it was optimizing for the ticket as written, and the ticket as written was the wrong question. Noticing the wrong question is the skill that turns into seniority. It is also exactly the skill you cannot buy for $200 a month.

The fix is not to stop giving that ticket to the plan. The fix is to change who is in the loop when it comes back.

## Run the Plan Like a Hire You Will Never Promote

If the plan is a junior, it is a specific kind: tireless, fast, confident, and permanently junior. It will not grow into the role. So you run it the way you would run a talented new hire in their first month, forever.

**Scope it like a first-month ticket.** Bounded, reversible, inspectable. One service, one change, a definition of done you could check without asking the author. The fourteen call site migration is a good plan ticket. "Make notifications more reliable" is not, because it hands the plan the part of the job that requires knowing history it does not have.

**Name the review seat before the work starts.** Not "someone will look at it." A person, by name, who owns the outcome of this PR and will be in the incident channel if it breaks. With a junior, review was partly teaching. With the plan, review is the entire safety system. The reviewer should be asking the question the plan cannot: what in this diff changed behavior that the ticket did not ask to change?

**Write the blast radius into the ticket.** Which files it may touch. Which shared code is off limits. What happens if it is wrong, and how you would know. The quiet normalization of that fifth retry is a scope change disguised as a cleanup. A ticket that says "preserve existing retry behavior per call site" turns a silent bug into a visible diff.

**Keep the history somewhere it can read.** The plan cannot remember your system, but it can read what you write down. The comment that explained the retry was the cheapest piece of context on the team and nobody kept it. Teams running agents seriously end up writing more of their history down, not less, because the new hire reads everything and remembers nothing.

None of this is exotic. It is how good managers already ran first-month hires. The difference is that the first month never ends, so the cost of skipping it never goes away either.

## Juniors Should Ask for Ownership, Not Tickets

If you are early in your career, the uncomfortable read is that the ticket queue, the place juniors used to learn, is being handed to a $200 plan. You cannot outwork it on bounded tickets and you should not try. That is a race against something that does not sleep and gets a free upgrade every few months.

The better move is to go after the part the plan cannot have: ownership. Ask to own a small system end to end. Not the tickets on it. The system. Be the person who knows why its retries look the way they do, who gets paged when it breaks, who writes the brief when it needs to change and runs the plan against that brief. Use the agent to do the typing on your system, and spend the saved hours on the part that compounds: reading the incidents, asking why the strange code is strange, writing down the answers.

That inverts the old ladder. Juniors used to earn ownership by grinding through tickets for a few years. Now the tickets are the cheap part, and the scarce thing is someone who can be trusted with an outcome. You get there faster by asking for a small outcome early than by competing with the plan for the queue.

For managers, the matching move is to keep hiring juniors and change what you hire them to do. Give them a small system and the plan, and hold them to the outcome. You get the throughput from the subscription and you keep buying the option, which is the only part of the old bundle you cannot get anywhere else.

## The Bottom Line

The $200 plan is the best junior hire you will ever make for bounded work, and it will never become a senior engineer. Run it like a permanent first-month hire: scoped tickets, a named owner, a written blast radius.

Buy the plan for the throughput. Keep hiring people for the judgment.
