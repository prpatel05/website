The triage agent had a completion rate in the high nineties for six straight weeks. It read inbound support tickets, routed them, drafted replies, and closed the easy ones. Then the engineer who ran it took a week off, and by Wednesday the completion rate was somewhere around seventy. Nobody had touched the model, the prompt, or the tools. The agent was exactly the same agent.

What had changed was the person. Every morning, before standup, he had been restarting the runs that hung overnight. He had been fixing the two ticket categories the agent always misrouted, by hand, before anyone noticed. He had been approving the refunds over the threshold that the agent correctly refused to approve on its own. It took him maybe forty minutes a day. None of it was written down anywhere, because none of it felt like work. It felt like keeping an eye on things.

Here is the inversion. The dashboard was not measuring the agent. It was measuring the agent plus one attentive person, and labeling the result autonomy. The number everyone quoted in planning meetings was real, but it described a system that included a human nobody had counted. The success rate that mattered was the one you get when nobody touches it, and nobody had ever looked at that number.

This is the third post in **Agents in Production**. [A Retry Is Not a Replay](/blog/a-retry-is-not-a-replay/) was about an agent doing the same write twice. [A Stuck Agent Looks Exactly Like a Busy One](/blog/a-stuck-agent-looks-exactly-like-a-busy-one/) was about an agent doing the same thinking a hundred times. This one is about the person who keeps both of those from showing up on the dashboard.

## Every Quiet Fix Makes the Dashboard a Little More Wrong

In [Half the Demos Are Fake Now](/blog/half-the-demos-are-fake-now/), the uncounted human was the person off camera who reran the take until it worked. Production has the same person, except the job is permanent and the camera is a metrics page.

The mechanism is simple. An agent run starts, gets stuck or goes slightly wrong, and someone steps in. They restart it. They edit the output before it ships. They approve the edge case. They nudge a config. The run then completes, and the system records a completion. The record has no field for "completed because Dave fixed it at 8:15." So the completion counts exactly the same as a run nobody touched.

Each individual fix is harmless and usually correct. The damage is in the aggregate. Every quiet intervention moves a failure out of the metrics and into someone's morning routine. Over weeks, the dashboard drifts away from the system it claims to describe. The success rate goes up. The cost model leaves out a salary. The team decides the agent is ready for more scope, because the numbers say so, and the numbers say so because a person has been absorbing the difference.

Then that person goes on vacation, changes teams, or simply gets busy, and the system loses capability it never officially had. Nothing broke. The hidden part of the system just stopped showing up.

## The Helpful Operator Is the Failure Mode

It is tempting to treat this as a discipline problem, as if the fix were telling people to stop helping. That gets it backwards. The person restarting runs is doing the right thing for the business on that day. The failure is structural. The system makes helping free and invisible, and makes recording the help a chore nobody asked for.

Look at how interventions actually happen. They rarely go through the agent's front door. Someone opens the admin panel and reruns a job. Someone edits a draft in the CRM after the agent wrote it. Someone merges the agent's PR after fixing two lines locally. Someone flips a feature flag to route a category away from the agent for an afternoon and forgets to flip it back. Each of those is a side channel. The agent's own logs see none of them, so the agent's own metrics cannot include them.

That is also why the people closest to the system are often the most surprised by the vacation week. They know they help. They do not know how much, because they have never seen it added up. Forty minutes a day does not feel like a dependency. Across a quarter it is a part time job, and it has been doing the part of the work the agent cannot.

## A Human Touch Is an Event, Not a Favor

The fix starts with making every human touch a first class event in the same stream as the agent's own actions. Not a note in Slack. Not a comment in a ticket. A structured record attached to the run it changed.

Each event needs four things. Which run it touched. Who touched it. What kind of touch it was. And a reason code from a short, fixed list. A starting list that covers most of what I see:

- **restart**: the run hung or died and someone started it again.
- **edit**: the agent produced an output and a person changed it before it shipped.
- **override**: the agent made a decision and a person reversed it.
- **approve**: the agent correctly stopped at a boundary and a person let it through.
- **reroute**: a person moved work away from the agent entirely.

The list is short on purpose. If it has thirty categories, nobody picks the right one. If it has five, people pick in two seconds, and two seconds is the whole budget you get.

Then close the side channels. The admin rerun button writes a restart event. The CRM edit on an agent authored draft writes an edit event, with a diff. The local fix before merge shows up as a human commit on the agent's branch, which you can detect without asking anyone. The routing flag writes a reroute event with an expiry. The goal is that helping and recording the help become the same action, so nobody has to remember to do the second one.

Note that **approve** is different from the others. An approval at a designed pause point is the system working as intended, the kind of stop from [Teach Your Agent to Ask for Help](/blog/teach-your-agent-to-ask-for-help/). It still counts as a touch, because it still costs a person's time, but it should be reported separately from the touches that mean something went wrong.

## Report the Number That Survives a Vacation

Once touches are events, the headline metrics change. There are two I would put at the top of any agent dashboard, above completion rate.

The first is **unassisted completion**: the share of runs that finished with zero human events of any kind except designed approvals. This is the real success rate. It is almost always lower than the completion rate, sometimes a lot lower, and the gap between the two is the size of the hidden person.

The second is **interventions per hundred runs**, broken down by reason code. This is the number that tells you where the hidden person is spending their time. If restarts dominate, you have a reliability problem in the harness, probably the stuck runs from the last post. If edits dominate, the output quality is not there yet and the agent is a drafting tool, which is fine, as long as everyone calls it that. If overrides dominate, the agent is making decisions it should not be making alone.

Put a cost on it. Multiply the touches by a rough time per touch and you get the people line the cost model was missing. It does not need to be precise. It needs to exist, because a cost model with a silent zero in it will always say the agent is cheaper than it is.

A useful test for any agent metric: would this number still be true the week the most helpful person on the team is out? If the answer is no, it is not measuring the agent.

## Interventions Are a Backlog, Not a Cost of Doing Business

The last step is the unglamorous one. Once a week, someone reads the intervention log and sorts it.

Most of it will cluster. The same ticket category misrouted again and again. The same tool timing out at the same hour. The same kind of draft getting the same edit. Each cluster becomes one of three things.

A **fix**, when the cause is in the agent or the harness: a prompt change, a tool contract, a timeout, a retry rule like the ones in the first post of this series.

A **rule**, when the agent keeps making a judgment call people keep reversing: write the judgment down and enforce it in code, so the agent no longer gets to make that call at all.

A **pause point**, when the human touch is actually correct and will stay necessary: make it an explicit, designed approval, so it moves out of the hidden column and into the counted one.

Run the opening story again with this in place. The misrouted categories show up in week one as a cluster of override events and become a routing rule. The overnight hangs show up as restart events, get traced to a tool that never returned, and get a timeout and a no progress budget. The refunds show up as approvals and become a named pause point with a queue someone actually owns. Unassisted completion starts lower than the old number, then climbs for real. And when the engineer takes his week off, the dashboard dips a little and the system keeps running, because the part he used to carry has been written into it.

## The Bottom Line

A completion rate that includes an uncounted person is not a property of the agent. It is a property of the person, and it leaves when they do.

Completion tells you what the system did. Unassisted completion tells you what the agent did, and that is the only number you can plan around.
