In April 2026, an AI coding agent [deleted a company's production database in nine seconds](https://www.euronews.com/next/2026/04/28/an-ai-agent-deleted-a-companys-entire-database-in-9-seconds-then-wrote-an-apology), then wrote an apology.

The part that stuck with me was not the deletion. It was what happened next. The backups were gone too. The most recent thing left to restore from was three months old. Three months of customer data, wiped by a single confident action, with nothing behind it.

The agent did not get hacked. It used [valid credentials, a valid endpoint, and a permitted operation](https://www.eon.io/blog/ai-agent-data-loss). Every individual step was allowed. The problem was that the most destructive thing it could do was also one of the easiest, and there was no way to take it back.

That is the failure mode I keep seeing under all the others. Not "the agent did something it was not allowed to do." Something quieter. "The agent did something allowed, and it could not be undone."

## Prevention and Detection Are Not Enough

I have written before about the two obvious levers. Decide what the agent is allowed to touch. Measure whether its work is actually correct. Both matter. Both are necessary.

Neither one helps you at 2am when a permitted action has already landed and it was wrong.

Prevention narrows the set of things that can go wrong. Detection tells you when one of them did. But there is always a gap between the moment a bad action executes and the moment you notice. In that gap, the only thing that saves you is whether the action can be reversed.

Reliability people have a name for the worst version of this: the blast radius. How much damage can one wrong move cause before anything stops it? For traditional software, a bad deploy has a blast radius you can reason about. For an autonomous agent making its own decisions about what to do next, [the blast radius gets wider and the rollback gets harder](https://tianpan.co/blog/2026-05-05-agent-blast-radius-bounding-worst-case-impact-production), because the agent can chain several allowed actions into one unplanned outcome faster than a human can react.

So the third lever is recovery. Design the system so that when the agent is wrong, and it will be, the mistake is cheap to take back.

## Reversibility Is a Property You Design

The instinct is to treat reversibility as a backup problem. Take snapshots, keep copies, restore if something breaks. That is the exact assumption that failed in the nine-second story. The backups shared the same credentials and the same control plane as the thing they were protecting, so the same action that killed production killed the safety net.

Reversibility is not a copy you keep. It is a property of each action the agent can take.

The most useful thing I have started doing is boring: classify every tool the agent has by how hard it is to undo.

Green actions are reversible and cheap. Reading data, running a query, drafting a message, opening a pull request. If the agent gets these wrong, you close the tab and move on. Let them run.

Yellow actions are reversible but not free. Writing to a database with a soft delete, sending an internal notification, changing a config that has a known rollback. These are fine to automate if you have actually tested the path back, not just assumed it exists.

Red actions are irreversible or externally visible. Hard-deleting data, moving money, sending an email to a customer, deleting the backups. These are the ones that should never be one confident sentence away from execution.

Once you sort tools this way, a lot of design decisions make themselves. The stronger the approval, the smaller the blast radius, and the clearer the evidence you require, the more irreversible the action is. That single rule of thumb would have stopped the nine-second incident cold.

## The Undo Button, In Practice

Giving an agent an undo button is less exotic than it sounds. It is mostly patterns engineers already know, applied one layer earlier.

Prefer soft deletes over hard deletes. A row marked deleted is an undo. A row that is gone is an incident. The agent should have to work much harder to do the second one.

Make destructive actions two-step. The agent proposes, something else confirms. That something can be a human for the truly irreversible stuff, or a separate check for the merely expensive stuff. The point is that no single call both decides and destroys.

Run in a copy first. Staging, a sandbox, a dry-run mode that shows the diff before it is applied. If the agent can rehearse the change against something that is not production, most bad plans reveal themselves before they touch anything real.

Keep the recovery path off the same switch. Backups that share credentials and storage with production are not backups. They are a second copy of the thing you are about to lose. Immutability and a separate control plane are the difference between a bad hour and a dead company.

Checkpoint the work. For multi-step workflows, save state between steps so you can roll back to the last good point instead of unwinding the entire run by hand. This is the recovery version of measuring the middle, and it is why teams increasingly treat [reversible autonomy as its own layer](https://medium.com/@raktims2210/the-enterprise-ai-control-plane-why-reversible-autonomy-is-the-missing-layer-for-scalable-ai-8dd1edef2ab5) of the stack rather than an afterthought.

None of this makes the agent smarter. It makes the agent's mistakes survivable, which is a different and more useful goal.

## Save The Human For The Irreversible

There is a real cost to a confirmation step. Ask a person to approve everything and you have not built an agent, you have built a slow form. So spend the human attention where it actually pays off.

The trigger is irreversibility, not importance. A reversible action can be big and still run on its own, because if it is wrong you fix it. An irreversible action can be small and still deserve a human, because if it is wrong you cannot. [Microsoft's guidance on autonomous agents](https://www.microsoft.com/en-us/security/blog/2026/05/14/defense-in-depth-autonomous-ai-agents/) lands in the same place. Let the low-risk, bounded, reversible work flow, and gate the actions whose worst case you could not walk back.

Done right, the human is not in the loop for everything. They are in the loop for exactly the handful of moves that cannot be undone. That is a load a person can actually carry, and it is where their judgment is worth the interruption.

## The Bottom Line

We spend most of our agent-building energy trying to make the agent right. That is the wrong thing to optimize alone, because it will still be wrong sometimes, and the interesting question is what happens when it is.

An agent whose every action is reversible can be wrong all day and cost you a few minutes. An agent with one irreversible action wired to a confident decision can be right for months and then end you in nine seconds.

So before you widen what your agent can do, ask the unglamorous question. If this goes wrong, can I take it back? If the answer is no, that action does not need a better prompt.

It needs an undo button.
