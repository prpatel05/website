The agent was asked to fix one failing integration test before morning. At 11pm it posted a reasonable plan. At midnight it reported that it had found the likely cause, a timezone assumption in a fixture. At 2am it reported that the fixture change had exposed a second issue and it was adjusting the mock. At 5am it was adjusting the mock again. When someone finally opened the branch, there were dozens of commits, and the last ten were the same two lines being flipped back and forth with slightly different comments. The test had never passed. The error message had not changed since 11:40pm.

Every individual update was believable. Every commit was small and well described. The dashboard showed a healthy run: steady token use, regular tool calls, no crashes, no errors from the harness. If you had glanced at it at any point during the night, you would have concluded the agent was working hard on a difficult bug. It was. It was also going nowhere, and nothing in the system could tell the difference.

Here is the inversion. We built our monitoring to catch agents that stop, crash, or go silent. The expensive failure is the opposite. A stuck agent is not quiet. It is the busiest thing in the system, and activity is exactly the signal it produces in abundance. If your definition of progress is something the agent can generate by itself (tokens, messages, commits, confident summaries), a loop will satisfy it forever.

This is the second post in **Agents in Production**. The first, [A Retry Is Not a Replay](/blog/a-retry-is-not-a-replay/), was about an agent doing the same write twice. This one is about an agent doing the same thinking a hundred times.

## Activity Is the One Signal a Loop Produces for Free

Most of what we measure about a running agent is output. Tokens per minute. Tool calls per step. Number of commits. Length and tone of the status update. Those are good measures of whether the agent is alive. They are terrible measures of whether it is getting anywhere, because a loop is made of output.

A crashed process is easy to catch. It stops emitting, a heartbeat goes stale, an alert fires. A looping agent never stops emitting. Each iteration produces a new tool call, a new reasoning trace, and often a new commit. The heartbeat stays green the entire time. The very instrumentation we added to prove the agent is working becomes the evidence that hides the fact that it is not.

The status updates make it worse. Models are fluent narrators, and a model in a loop narrates each lap as a fresh discovery. "Found a second issue." "Refining the approach." "Close now, adjusting one assumption." Each line is locally true. Read in sequence, they describe a circle. But nobody reads them in sequence at 3am. They read the latest one, and the latest one always sounds like progress.

This is the same shape as the uncounted human in [Half the Demos Are Fake Now](/blog/half-the-demos-are-fake-now/): the system reports what it can see about itself, and what it can see about itself is flattering.

## The Loop Never Repeats Exactly

You might expect loops to be easy to detect because they repeat. In practice they almost never repeat exactly, and that is why naive checks miss them.

A classic infinite loop in code runs the same instruction with the same state. An agent loop varies on every lap. The plan is reworded. The diff touches the same lines with different whitespace or a renamed variable. The shell command gains a flag. The error is the same, but the stack trace has a different temp path or timestamp in it. A string comparison between iteration seven and iteration eight says they are different, and in the narrow sense they are.

What stays constant is the thing the agent is not changing: the outcome. The same test fails with the same assertion. The same file ends up in the same state it was in two hours ago. The same API returns the same 409. The agent is varying its inputs while the world returns the same answer, which is a near perfect description of being stuck, and also a near perfect description of honest debugging for the first few attempts. The difference is only visible across many laps.

So loop detection cannot be a rule about the agent repeating itself. It has to be a rule about the world not moving.

## Progress Has to Be Measured Outside the Agent

The fix starts with a definition. Progress is a state change that the agent cannot produce by talking. A test that newly passes. A file whose content hash differs from every previous state in this run. A record that exists now and did not before. A CI check that moved from red to green. An item that left the queue.

Each of those is checked by something other than the model. The harness runs the test. The harness hashes the working tree. The harness queries the database. The model is free to say it made progress, but its saying so does not count. Only the external check counts, and the external check is cheap, boring, and impossible to persuade.

For most agent tasks this means writing down, before the run starts, what a step forward looks like. For a bug fix, it is a failing test going green, or at least a different failure than the one you started with. For a migration, it is the count of migrated records going up. For a research task it is harder, but there is still usually a concrete artifact (a source cited that was not cited before, a section of the document that now exists). If you cannot name any external state that should change when the agent succeeds, you have found a task that is not ready to run unattended, and that is worth knowing before the overnight run, not after.

## Fingerprint the Outcome, Not the Attempt

Once progress is defined as external state, loop detection becomes mechanical.

After every step, the harness records a fingerprint of the world, not of the agent. Normalize the error (strip timestamps, temp paths, line numbers that shift, request IDs) and hash it. Hash the working tree or the relevant files. Record the set of passing tests. Then compare the new fingerprint to every previous one in the run.

If the fingerprint is new, the world moved. Reset the counter. If the fingerprint matches one you have already seen, the agent has returned to a state it has already been in, which is the definition of a cycle no matter how differently it got there. Increment the counter. When the counter hits a small number (three is a reasonable start for most coding work), stop.

That stop needs its own budget, separate from the spend cap. A spend cap answers "how much are we willing to pay for this goal." A no progress budget answers "how long are we willing to watch nothing happen." They fail differently. A spend cap on an overnight run might allow hours of looping before it trips, and when it trips it reads as "ran out of money," which hides the real cause. A no progress budget trips early and names the problem correctly: the agent tried several distinct things and the world did not change.

None of this requires the model to notice it is stuck. Models are not reliably good at that, for the same reason people are not: each attempt feels new from the inside. The harness is outside, has a memory of every state, and does not get optimistic at 3am.

## The Stop Is a Deliverable

The last part is the one most teams skip. When the loop detector fires, what the agent produces next matters as much as the fact that it stopped.

A bad stop is a terminated run and a log. Somebody has to read six hours of transcript to figure out what happened, and usually they give up and rerun it, which loops again.

A good stop is a short report the harness assembles from the fingerprints it already has. The goal. The external check that defined progress. The distinct approaches that were tried, one line each. The state the world kept returning to, with the normalized error. The last state that was genuinely new. Then a specific question: "The test still fails on the same fixture assertion after three different timezone fixes. Is the fixture or the expectation wrong?"

That report is useful even when the agent failed. It turns six hours of compute into a well posed question that a person can answer in two minutes, and it pairs naturally with the pause points from [Teach Your Agent to Ask for Help](/blog/teach-your-agent-to-ask-for-help/). The difference is who decides to pause. In that post the agent recognizes uncertainty and asks. Here the harness recognizes a cycle the agent cannot see, and asks on its behalf.

Run the opening story again with this in place. The test fails at 11:40pm with a normalized error fingerprint. The agent changes the fixture. The test fails with a new fingerprint, so the counter resets, which is correct, because something did move. The agent adjusts the mock. Same fingerprint as the previous state. Then a third variation, same fingerprint again. At about 1am the no progress budget trips. The run stops, the report lists three attempts and the assertion that never changed, and in the morning there is one clear question waiting instead of forty commits to unwind.

It is not a smarter agent. It is a hash, a counter, and a rule that only the world gets to say whether work happened.

## The Bottom Line

A loop does not look like failure. It looks like effort, and effort is the one thing a stuck agent never runs out of.

A busy agent produces output. A working agent changes the world, so measure the world and let the output say whatever it wants.
