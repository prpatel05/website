The standard coding interview gives a candidate forty-five minutes to reverse a linked list, merge some intervals, or find the longest palindromic substring. A coding agent does any of those in less time than it takes the interviewer to finish reading the prompt aloud.

That gap is not the problem. The problem is what the loop says about the job. Picture the candidate who aces it: clean recursion, the optimal complexity named before anyone asks, edge cases handled on the whiteboard. Six weeks after starting, they approve an agent-written PR with green tests and a tidy description. It quietly lets one customer's admin export another customer's data. Nobody in the hiring loop ever asked them to read a diff they did not write.

Here is the inversion. We built interviews to measure the expensive part of the work, and for a long time the expensive part was producing correct code under pressure. That part is getting cheap. What stays expensive is judgment: scoping the ticket, picking what not to build, reading a diff for what it actually changes, knowing the blast radius, deciding when to stop. If the agent does the typing, an interview that grades typing is measuring the one skill you no longer need to hire for.

## Leetcode Grades the Part the Agent Already Does

A whiteboard problem is a closed world. The spec is complete, the inputs are clean, the answer is known, and the interviewer already holds it. The candidate's job is recall plus execution under a clock. That was a reasonable proxy when execution was the bottleneck and recall was a decent signal of hours spent writing code.

Look at what the format leaves out. There is no ambiguous ticket. There is no existing codebase with seams you are not allowed to cross. There is no second author whose work you have to trust or distrust. There is no production, no customer, no rollback. Every hard part of the actual job has been removed so the easy part can be graded cleanly.

Coding agents are very good inside closed worlds. Hand one a complete spec with known answers and it will produce something that passes. So the format now selects for the skill most easily delegated, and it says nothing about the skill that decides whether delegation is safe. You end up hiring for the demo and finding out about prod later.

## The Job Moved to the Review Seat

When I look at where my own days go now, very little of it is typing. It is writing the brief that keeps a run bounded. It is reading what came back and deciding whether to believe it. It is noticing that a fix touched a shared utility it had no reason to touch. It is saying "stop, this is done" while the agent is still offering to improve things.

That is the review seat, and it is the seat every engineer now sits in, whether their title says senior or not. The agent is a prolific, confident, occasionally wrong author. The human is the reviewer of record. The quality of what ships depends far more on the reviewer than on the author, because the author will produce something plausible every single time.

Plausible is the hard part. Bad code that looks bad is easy to reject. Agent output fails in a more expensive way: it looks finished. The tests pass because the tests were written alongside the code and share its assumptions. The description is fluent. The diff is formatted. The flaw sits in a permission check, a missing limit, or a scope change three files away from the ticket. Catching that is not a typing skill. It is a reading skill, a skepticism skill, and a knowing-what-matters skill.

If that is the job, the interview should put the candidate in that seat and watch what they do.

## Hand Them a Plausible Wrong PR

The mechanism is simple to describe and unglamorous to build. Replace the whiteboard round with a review round.

Give the candidate three things: a short ticket written the way real tickets are written, a small repo they can run, and a PR that claims to close the ticket. The PR was produced by an agent and then deliberately seeded with a handful of flaws. Some are subtle and serious. One is obvious and minor. One piece of the diff looks alarming but is actually fine. Tests are green.

The candidate gets about an hour, can run anything, can ask the interviewer anything, and has to end with a decision: approve, approve with changes, split, or reject. They also have to say what they would ship today if the deadline were real.

You grade three things.

**What they catch.** Not the count. The order. A candidate who flags a naming nit first and the data leak last has the priorities of a linter. A candidate who goes straight for the authorization path has been burned before, or has the instinct that matters.

**What they ask.** The ticket should be ambiguous in one place on purpose. Strong candidates find the ambiguity and ask about it before judging the code against it. Weak candidates assume, and grade the PR against an assumption nobody stated.

**What they ship.** This is the part whiteboards never see. Does the candidate know the difference between blocking and non-blocking? Can they carve out a bounded, reversible piece that is safe today and defer the rest? Do they leave the scary-but-correct code alone, or do they rewrite it because it offends them?

That last question matters more than it looks. Knowing what not to touch is half of judgment. A reviewer who "fixes" everything they dislike is just another agent with a wider blast radius.

## A Worked Loop: The Invoice Export That Almost Shipped

Here is one round, concrete enough to build next week.

The ticket: "Account admins need to export their invoices as CSV from the billing page." That is the whole ticket. It does not say how many invoices the largest account has. It does not say whether "account admins" includes the internal support role.

The repo is a small service with an invoices table, a role model, and a billing page. The PR, written by an agent and then seeded, does the following:

It adds an export endpoint that checks whether the caller has the admin role. It does not check that the account in the request is the caller's account. Change the account id in the URL and an admin of one customer exports another customer's invoices. This is the serious flaw. Tests pass because the fixtures only contain one account.

It loads every invoice for the account into memory, builds the CSV as a string, and returns it. Fine on fixtures. On a large account it will fall over, and the ticket's silence on volume is the ambiguity the candidate should ask about.

It "cleans up" a shared date formatting helper on the way through, changing its output format slightly. Nothing in the ticket asked for that. The helper is also used by the code that renders invoice emails. No test covers the email path. This is the quiet scope creep that ships a bug into a feature nobody was looking at.

It includes a test named for the export behavior that actually asserts against a mocked repository, so it would pass even if the endpoint returned nothing useful. This is the test that makes green mean less than it seems.

It writes customer-supplied invoice memo fields straight into CSV cells without escaping. Minor for this round, and deliberately easy to spot.

And it contains one ugly, verbose block that handles currency rounding in an unusual way. It looks wrong. It is correct, and there is a comment pointing to why. This is the bait.

A strong session tends to look like this. The candidate reads the ticket and asks two questions: how big can an account get, and who counts as an admin. They run the tests, see green, and do not stop there. They open the endpoint first because it is the new trust boundary, and they find the missing account scope within minutes. They notice the date helper diff, grep for its callers, find the email path, and flag it as unrelated to the ticket. They read the mocked test and say plainly that it proves nothing. They mention the CSV escaping. They read the rounding block, read the comment, and leave it alone.

Then the decision. Not "approve with comments." Something like: reject as written. Split it. Revert the date helper change entirely, it is a separate PR with its own review. Fix the account scope check and add a test with two accounts that fails before the fix. Cap the export or stream it, depending on the answer about account size. Replace the mocked test with one that exercises the endpoint. Ship the export behind a flag to internal accounts first. That is a bounded, reversible, inspectable plan, and it came from someone who did not type a line of the feature.

A weaker session also looks familiar. The candidate rewrites the rounding block, praises the tests, suggests renaming the endpoint, and approves. Every comment is defensible. None of them is the one that matters.

You do not need a scoring formula to tell those two apart. Any experienced reviewer on the panel will know within the hour.

## Stopping Is a Skill You Can Score

The most underrated part of the round is the end. Agents do not stop on their own. They will keep refactoring, keep adding tests, keep offering a better version. The human has to decide that the work is done, that the remaining issues are acceptable, and that the next change belongs in a different PR.

So score the stop. Did the candidate land on a decision, or keep exploring until time ran out? Did they separate what must block this PR from what can wait? Did they name what they did not check and why it was safe to leave unchecked? A reviewer who cannot stop is as dangerous as one who stops too early, just more expensive.

This also fixes a quieter problem with the old loop: it rewards a certain kind of performance. Whiteboards favor people who have rehearsed the genre. A review round favors people who have been on call, who have rolled something back, who have read a postmortem with their own name in it. Those are the people you want reading agent output at five in the afternoon on a Friday.

The round is more work to build than a list of puzzles. You need a realistic repo, a seeded PR, and interviewers who agree on what good looks like. That cost is the point. It is the same contract you should already be writing for your agents: a ticket with a clear stop condition, a known blast radius, and evidence that survives a handoff. If your team cannot write that for an interview, it probably cannot write it for a run either.

## The Bottom Line

When the agent can type the answer, grading the typing measures nothing you need.

A whiteboard shows you who can write the code. A seeded PR shows you who can stop the wrong code from shipping.
