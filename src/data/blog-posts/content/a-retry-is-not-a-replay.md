The customer got the follow-up email three times. Each one was polite. Each one was slightly different. The first apologized for the delay, the second was shorter and skipped the apology, and the third added a line about a refund nobody had approved. The agent's run log showed a single failed step, a timeout on send, and then a recovery. From where the agent sat, it had handled an error well.

Nothing in that chain was a model failure. The draft was fine. The send worked, all three times. The provider was slow to answer, the tool call timed out, and the agent did what everything in its context told it to do: the step failed, so try again. It wrote a fresh email, because that is what it does when asked to send one, and sent that. Then the orchestrator saw a step that had needed recovery and restarted the run from the top, which produced the third.

Here is the inversion. In ordinary software, a retry is a replay: the same request, sent again, hoping the network cooperates this time. For an agent, a retry is a new decision, made by a model that knows less than it did the first time, because it no longer knows whether the first attempt landed. Retries are not a reliability feature you can bolt on. They are a second write you have to make safe in advance.

This is the first post in **Agents in Production**, a series about one concrete failure mode at a time and the unglamorous fix for it. It picks up where [Half the Demos Are Fake Now](/blog/half-the-demos-are-fake-now/) left off. A demo is a success rate of one with someone watching. Production is every input, unattended, including the ones where the network blinks. Retries are where that difference shows up first.

## For an Agent, Every Retry Is a New Decision

When an HTTP client retries, it sends the same bytes. The method, the body, and the headers are identical. If the server is built well, it can recognize the second request and do nothing new.

An agent does not resend bytes. It sees an error in its context, reasons about it, and produces another action. That action might use the same tool with the same arguments. It might use the same tool with different arguments, because the model regenerated the content. It might pick a different tool entirely, because the error message suggested the first one was broken. It might decide the problem was the wording and rewrite the whole thing more carefully. Every one of those is a reasonable response to "that did not work." None of them is a replay.

That is why the three emails were different. The model was not malfunctioning. It was doing the job it was given, which was to accomplish a goal, and from its point of view the goal had not been accomplished yet. A deterministic retry repeats an instruction. An agent retry re-derives one, and the derivation is new every time.

The practical consequence is that the downstream system has nothing to match on. The second email has a different body and a different subject line. The second pull request has a different branch name. The second ticket has a different title. Even a careful API cannot tell it is looking at the same intent twice, because on the wire it is not the same intent. It only means the same thing to a human reading both.

## A Timeout Means You Do Not Know

Most write failures fall into three buckets. The write definitely happened. The write definitely did not happen (a validation error, a rejected permission, a 400). Or you have no idea, because the connection dropped, the call timed out, or the response came back as a server error after the work was done.

Agents collapse the third bucket into the second. A timeout shows up in context as an error, and an error reads like a failure, so the natural next move is to do the thing again. For a read, that is fine. Reading twice is free. For a write, "unknown" is the most dangerous state you have, because the cheapest assumption (it failed) is also the one that causes duplicates when it is wrong.

The fix starts with naming the state. When a write times out, the step is not failed. It is unknown, and the only valid next action from unknown is a read: go check whether the thing exists. Did the message go out? Is there a PR on that branch? Is there a ticket with this reference? If yes, record success and move on. If no, and you are confident no is the real answer, then you can write again.

This sounds obvious written down. It is rarely how agent tools are built. Most tool wrappers I see return an error string and let the model decide what it means. The model decides it means try again.

## Retries Stack Quietly Across Layers

The third email in that story did not come from the agent at all. It came from the orchestrator, one layer up, which had its own retry policy. And underneath the agent, the HTTP client probably had one too.

This is how retry storms happen in agent systems. The client retries a failed call a few times. The tool wrapper retries the client a few times. The model, seeing an error, retries the tool. The orchestrator, seeing a failed step, restarts the step or the whole run. Each layer was configured by someone reasonable, in isolation, and each one assumed it was the only layer retrying. Three layers that each try three times can produce twenty seven attempts at the bottom from one bad minute. That is arithmetic, not a measurement, but it is the arithmetic you are signed up for if nobody owns the stack.

At the bottom of the stack, the layers that resend identical bytes are the least dangerous, because a well built API can deduplicate them. The model and the orchestrator are the dangerous ones, because they regenerate. So the instinct to "add retries for reliability" at the agent layer is backwards. The higher up the retry lives, the more it changes between attempts, and the bigger the blast radius when the first attempt actually worked.

The rule I use is simple: for any write, exactly one layer owns retries, and it is the lowest layer that can make the retry identical. Everything above it treats an unknown outcome as a reason to check, not a reason to act.

## Make the Second Attempt Safe, Not Rare

You cannot make timeouts go away. Networks fail, providers are slow, and long agent runs will hit every flaky edge your infrastructure has. Trying to make retries rare is a losing game. The goal is to make the second attempt harmless.

The mechanism is old. Plenty of AWS APIs that create resources accept a client token for exactly this reason: if the same token shows up twice, the service returns the original result instead of creating a second resource. Payment APIs do the same with idempotency keys. The pattern is well understood for services. It just has not been carried over to agents, because agents broke one of its assumptions.

That assumption is that the retry is the same request. So two changes are needed for an agent.

**Key the side effect by intent, not by attempt.** The idempotency key is not a random value generated per call. It is derived from what the agent is trying to do: this task, this step, this target. "Send the follow-up for ticket 4417, step four" produces the same key no matter how many times the model reaches for the send tool. Pass it to the downstream API if it supports one. If it does not, keep your own ledger: before the write, check whether this key already succeeded, and after the write, record it.

**Freeze the artifact before the write.** The model drafts the email once. The draft is saved as an artifact attached to that step. The send tool sends the artifact, not whatever the model produces next. A retry resends the frozen draft with the same key. If the model genuinely needs to change the content, that is a new step with a new key, and it is a visible decision in the trace instead of an accidental one.

Together those two changes restore the thing agent retries lost: the second attempt looks like the first one, so the system can recognize it. This pairs with the reversibility work in [Give Your Agent an Undo Button](/blog/give-your-agent-an-undo-button/), but it is a different property. Undo assumes you noticed the duplicate. Idempotency means there is no duplicate to notice.

## The Same Email, Sent Safely

Run the opening story again with the fix in place.

The agent triages the ticket and drafts the follow-up. The draft is stored as an artifact on step four, with a key derived from the ticket and the step. The send tool is the only thing allowed to deliver it, and the tool takes the artifact reference and the key, not free text.

The provider is slow. The call times out. The tool does not return "error." It returns "unknown: send may have succeeded, key K, check before retrying." The orchestrator knows that an unknown write is not a failed step, so it does not restart the run.

The next action is a read. The tool asks the provider whether a message with that key or that message ID was accepted. If the provider does not support lookups, it checks the sent folder for the reference it stamped on the message. It finds the message. The step is marked done, the trace records one timeout and one confirmation, and the run continues. The customer gets one email.

If the read had come back empty, the retry would have sent the same frozen draft with the same key. If that also timed out, the step would have stayed unknown, retried within a small budget, and then stopped and asked a human, with the key and the evidence attached. At no point does the model get to write a new email because the old one did not seem to work.

None of this is clever. It is a status enum with three values instead of two, a key, a stored draft, and one rule about which layer is allowed to retry. It is also the difference between an agent you can leave running overnight and one you have to watch, because the failure it prevents is exactly the kind nobody notices until a customer forwards all three emails back to you.

## The Bottom Line

Retries in agent systems are not reliability. Unless you design the second attempt, every retry is a fresh write made by something that has forgotten whether the first one landed.

A replay sends the same request twice and trusts the server to notice. An agent regenerates the request, so you have to make it the same request on purpose.
