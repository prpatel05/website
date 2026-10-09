The most expensive bug on most teams is not the one a customer hits on launch day. It is the one the team has been quietly stepping around for six weeks before that.

It goes like this. A feature ships behind an internal flag. The team uses it for six weeks. It mostly works. Nobody files anything, because nobody outside the team can see it, and the people inside the team have learned which buttons not to press. Then it goes wide, and on day one a customer hits the exact edge case the team had been stepping around since week two. Six weeks of failure happened. None of it was recorded. None of it taught anyone anything.

The usual story says private is the safe place to fail. You get to be wrong without the embarrassment. The inversion is that private is where failure is most expensive, because it is where failure is slowest to surface and least likely to change anything. A public failure is loud, fast, and attributable. A private failure is quiet, open-ended, and owned by nobody. I put a short version of this on X in August: failing in private is so much worse than failing in public. This is the long version.

## A Private Failure Has No Feedback Loop

Every improvement loop has the same shape. Something breaks, a signal travels to someone who can act, they act, and the next version is better. Remove any link and the loop stops. Private failure removes the second link. The break happens, but the signal goes nowhere.

That is worse than it sounds, because the break does not stop happening just because nobody reports it. It keeps happening. People route around it. The workaround becomes folklore ("don't paste more than one row into that field"). The folklore becomes the spec. By the time the failure finally reaches someone with authority to fix it, it has a blast radius of six weeks of habits, two downstream assumptions, and one customer who now doubts the whole product.

I wrote about the agent version of this in [Agents Fail Quietly](/blog/agents-fail-quietly/): a passing test and a working workflow are not the same thing, and the gap between them is where production breaks. Private shipping is the human version of the same gap. The internal flag passes. The team's muscle memory passes. The real workflow, run by someone who does not know where the bodies are buried, has never been tested at all.

## Visibility Is a Latency Problem, Not a Marketing Problem

When people hear "fail in public," they hear build in public: post the progress, grow the audience, turn the messy middle into content. That is a distribution play, and I have made that case before in [Distribution Is the New Code](/blog/distribution-is-the-new-code/). This is a different claim. It is about feedback, not reach.

The variable that matters is time to signal: how long between the moment something breaks and the moment a person who can fix it knows. In private, that number is unbounded. It depends on someone noticing, caring, and deciding the failure is worth raising instead of working around. In public, it collapses. A user hits the bug and tells you, because they have no folklore to fall back on and no reason to protect your feelings.

"Public" here does not have to mean a post on X. It means outside the circle of people who already know how the thing is supposed to work. A real user on a real account. A changelog line that invites replies. A status page that admits the degraded path. A teammate from another group who was never in the planning doc. What makes the failure useful is not the audience size. It is that the people watching are not already compensating for it.

Fast and visible beats slow and silent almost every time, for the same reason short feedback loops beat long ones everywhere else in engineering. You learn more from ten small breaks in a week than from one big break after a quarter, because each small break carries a cause you can still find.

## The Support Email Is the Fastest Test You Own

I posted this one in October: "The model can write the feature. It will not answer the support email."

The second sentence is the important one. Agents have made the build side cheap. They have done nothing for the side where the build meets a person who did not write it. The support email is that seam. It is the first moment your software is used by someone with no context, no patience for workarounds, and no stake in it being fine.

That makes the support inbox the most honest test suite you have. It is slow to write, impossible to fake, and it only covers the paths real people actually take. Teams that ship privately do not get that suite. They get a shorter, kinder one, written by the people least likely to find the bug.

There is a trap here worth naming. A team can generate features faster than ever and still learn slower than ever, because the learning happens in the inbox and the inbox only fills when the feature is in front of real users. Shipping volume is not learning rate. Visible failures per week is closer.

## Bound the Failure, Then Put It on Stage

None of this means ship recklessly. "Fail in public" is only good advice when the failure is small enough to survive. The mechanism is two moves in order: make the failure bounded, then make it visible.

**Bounded** means the worst case is something you can name before you ship. A small percentage of users, one region, a feature that can be switched off without a deploy, data writes that can be reversed. I covered the reversibility half of this in [Give Your Agent an Undo Button](/blog/give-your-agent-an-undo-button/). The same logic applies to features: a failure you can take back is a failure you can afford to show.

**Visible** means the failure reaches someone who can act, quickly, without a human having to decide it is worth reporting. A reply-to address on the release note. An error that surfaces to the user instead of being swallowed. A dashboard someone actually looks at. An explicit line in the changelog that says what is new and likely rough.

Bounded without visible is the internal flag: safe, and silent. Visible without bounded is a launch that breaks for everyone at once: loud, and expensive. Both together is the useful middle. The failure is small, it is fast, and it is inspectable, which means it turns into a fix instead of a habit.

The unglamorous part is that this takes design work up front. You have to build the off switch before you need it, and you have to write the changelog line that admits the feature is new. Most teams skip both because the private path feels faster. It is faster to ship. It is much slower to learn.

## The Same Feature Fails Better in Public

Take one feature and ship it two ways. Say it is a CSV import an agent built in an afternoon: upload a file, map the columns, write the rows.

**Path one, private.** It goes behind an internal flag. The team tries it with the three sample files they have. It works. Someone notices it chokes on a file with a trailing empty column, and quietly deletes the column before uploading. Someone else notices dates come in shifted by a day for one locale, and fixes them by hand in the table afterward. Nobody files either one, because each feels like a quirk, and the person who would fix it is busy shipping the next thing. Six weeks later it goes to everyone. Day one, two customers hit both bugs. One of them has already imported four hundred rows with shifted dates. The fix is easy. The cleanup is not.

**Path two, public and bounded.** The same import ships on day two to a small slice of real accounts, with a changelog line ("new: CSV import, still rough, reply here if it eats your file"), writes that can be rolled back per import, and errors that surface to the user instead of failing silently. In the first week, three people reply. One sends the file with the trailing column. One reports the shifted dates, with a screenshot. One reports a bug the team would never have found, because none of their sample files had a header row in a second language. Each report arrives within a day of the failure, with the input that caused it attached. Each fix lands while the cause is still obvious. The rollback means the shifted rows get reversed, not hand-edited.

Same feature. Same bugs. The difference is not the quality of the code. It is the length of the loop. Path one paid for six weeks of failure and got nothing for it. Path two paid for one rough week, in front of a bounded set of people who were told what they were getting, and came out with a better import and a record of why.

That is what the slogan means. The public failure was not more embarrassing. It was more useful, because it happened where the signal could travel.

## The Bottom Line

A private failure is still a failure. It just has no witness, no signal, and no fix attached.

Fail quietly and you repeat the lesson for months. Fail visibly, and boundedly, and you learn it by Thursday.
