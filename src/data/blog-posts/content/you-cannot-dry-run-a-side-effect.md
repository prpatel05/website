There is a sentence in the document that defines HTTP that I think about more than almost any other, and I have never seen anyone quote it. It lives in the section on safe methods — the section people reach for when they want to say that a read cannot hurt you.

> "Likewise, a safe request initiated by selecting an advertisement on the Web will often have the side effect of charging an advertising account."

That is [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), the current HTTP specification, published as an internet standard in June 2022. It is describing a read-only request that spends money. And it is not describing a bug. It offers the charge as an example of behaviour that is still, correctly, called safe.

The paragraph it sits in explains why:

> "This definition of safe methods does not prevent an implementation from including behavior that is potentially harmful, that is not entirely read-only, or that causes side effects while invoking a safe method. What is important, however, is that the client did not request that additional behavior and cannot be held accountable for it."

Safety, in the document that gave the web the word, is not a claim that nothing happened. It is a claim about what the client asked for and who is answerable for it. The spec says in writing that the world may change anyway.

I want to stay with that sentence, because it is the shape of a problem we are now shipping at scale. We hand systems to agents on two assumptions that feel like engineering and are closer to grammar. The first is that we can rehearse an action before committing to it. The second is that we can repeat one that failed. Both are addressed directly in the standards. Both are weaker than we think. And they are weaker in the same way.

## A Dry Run Is a Claim About Intent

Ask what a dry run actually asserts.

It says: I sent something shaped like the real request, and I did not ask for the effect. That is a statement about the request. It is not a statement about the state the system arrived in, and it never was — which is exactly the distinction RFC 9110 draws when it says the client "did not request that additional behavior."

The spec then goes further and warns about the case where the shape lies. It is worth reading slowly, because it was written about crawlers and it now describes your agent:

> "For example, it is common for Web-based content editing software to use actions within query parameters, such as “page?do=delete”. If the purpose of such a resource is to perform an unsafe action, then the resource owner MUST disable or disallow that action when it is accessed using a safe request method. Failure to do so will result in unfortunate side effects when automated processes perform a GET on every URI reference for the sake of link maintenance, pre-fetching, building a search index, etc."

Note where the obligation lands. The client is not asked to be careful. The client is expected to fetch everything it can see, and the *resource owner* carries the duty to make sure that fetching is harmless. The spec's stated purpose for the safe/unsafe distinction is "to allow automated retrieval processes (spiders) and cache performance optimization (pre-fetching) to work without fear of causing harm."

That contract was written for a machine that reads every link it finds. We have now built a machine that reads every link it finds, reasons about what the link probably does, and then acts on the answer. It inherits the whole contract, including the half that was never the client's job to enforce.

So a dry run is only as good as the other side's willingness to honour it. That is not a criticism of dry runs. It is a description of what kind of object they are: a request for a rehearsal, granted at the discretion of a system you do not control.

## Even the Method the Spec Blesses Leaves Marks

The retry side has the same structure, and one sentence in RFC 9110 does more damage to the folk model than anything else I found:

> "Like the definition of safe, the idempotent property only applies to what has been requested by the user; a server is free to log each request separately, retain a revision control history, or implement other non-idempotent side effects for each idempotent request."

Idempotent does not mean side-effect-free. The method the spec singles out as repeatable is explicitly permitted to leave a different mark on every attempt. Send the same PUT twice and the resource ends up in one state, which is the property you wanted — and the audit log, the revision history, the webhook fan-out and the billing meter are all free to count two.

This is why the rehearsal question and the retry question are one argument rather than two. In both cases the standard defines the property over the request the client made, and then explicitly declines to define it over what the system did in response. Safety and idempotence are both statements of intent with a documented gap underneath them.

If you have read [the case for giving your agent an undo button](/blog/give-your-agent-an-undo-button/), this is the layer beneath it. That piece was about actions you can take back. This one is about the moment before you know whether there is anything to take back.

## Retry Safety Is Bookkeeping You Did Before the First Attempt

Here is the sentence that ought to be pinned above every agent loop in production:

> "A client SHOULD NOT automatically retry a request with a non-idempotent method unless it has some means to know that the request semantics are actually idempotent, regardless of the method, or some means to detect that the original request was never applied."

Two escape hatches, and it is worth noticing what they have in common. One is knowledge about the endpoint's semantics. The other is a channel for observing whether the first attempt landed. Both are *knowledge the client has to already possess*. Neither is something you can derive from the failure, because the failure is precisely the event that destroyed your information.

An agent hitting a timeout has one fact: the response never arrived. That fact is compatible with the request never being sent, being sent and dropped, being applied and the acknowledgement lost, or being applied twice by a proxy in between. The retry decision needs to distinguish those. The timeout cannot.

The spec knows what happens next, and names it without flattery:

> "Some clients take a riskier approach and attempt to guess when an automatic retry is possible."

Guessing is the default behaviour of every retry wrapper I have ever written, including the ones I was proud of. A number in a config file is not a means to know and it is not a means to detect. It is a budget for guesses.

And then the line that closes the door:

> "A proxy MUST NOT automatically retry non-idempotent requests. A client SHOULD NOT automatically retry a failed automatic retry."

Read the second half against how agents actually behave. An agent whose tool call fails does not stop. It reasons about the failure, decides the operation is probably worth another attempt, and issues one. If that fails, it reasons again. The loop has no notion that attempt three is a retry of a retry, because from inside the loop every attempt is a fresh decision that happens to look identical to the last one.

## The Spec Describes a Client That May Retry, and It Is Not Yours

RFC 9110 does not simply forbid this. It describes the client that is allowed to do it, and the description is the most useful engineering guidance in the section:

> "Likewise, a user agent designed specifically to operate on a version control repository might be able to recover from partial failure conditions by checking the target resource revision(s) after a failed connection, reverting or fixing any changes that were partially applied, and then automatically retrying the requests that failed."

Every clause is load-bearing. The client is *designed specifically* for one domain. It *checks the target resource* after the failure. It *reverts or fixes* what partially applied. Only then does it retry.

That is not a retry policy. It is a reconciliation loop, and it is built out of domain knowledge that cannot be factored into a generic wrapper. The other example the spec gives has the same shape: a user agent may repeat a POST "if it knows (through design or configuration) that the request is safe for that resource." Through design or configuration — which is to say, because a human put the knowledge there in advance.

The permission to retry is never granted to the retrier. It is granted to whoever did the work beforehand.

## Exactly Once Is a Window

Now look at how the two best-documented implementations of "retry safely" actually deliver it, because both of them publish the mechanism and both publish a number.

[Stripe's idempotency documentation](https://docs.stripe.com/api/idempotent_requests) is the reference implementation of manufactured idempotence over an API that has none:

> "Stripe's idempotency works by saving the resulting status code and body of the first request made for any given idempotency key, regardless of whether it succeeds or fails. Subsequent requests with the same key return the same result, including 500 errors."

The key comes from the caller, before anything is attempted: "A client generates an idempotency key, which is a unique key that the server uses to recognize subsequent retries of the same request." And the guarantee has a stated shelf life:

> "You can remove keys from the system automatically after they're at least 24 hours old. We generate a new request if a key is reused after the original is pruned."

Amazon's page is titled [Exactly-once processing in Amazon SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues-exactly-once-processing.html), and the mechanism underneath the title is the same shape with a different number:

> "If you retry the SendMessage action within the 5-minute deduplication interval, Amazon SQS doesn't introduce any duplicates into the queue."

Read those two together and the marketing tense dissolves. Neither vendor is doing something exotic. Both are keeping a record of what they have already seen, for a bounded time, on the condition that you gave them something to record it against. Amazon states that condition as an instruction: "To configure deduplication, you must do one of the following." Enable content-based deduplication, or supply the deduplication ID yourself.

I am not going to tell you which window is correct, and I would be suspicious of anyone who did. One is five minutes, the other is twenty-four hours, and the gap between them is the point. These are engineering choices about how much state a vendor is willing to hold, not a discovered constant. What is common across both is not the duration. It is that the safety came from work performed *before the first attempt*, by a client that generated an identifier in advance, against a server that agreed to remember it.

Which means the retry decision was never made at failure time. It was made when the request was constructed. By the time your agent is looking at a timeout and deciding whether to try again, the only moment at which the question could have been answered safely has already passed.

## The Two Places Agents Fall Out of the Window

Everything so far is true of ordinary software, and ordinary software has lived with it for decades. Two things change when the client is an agent, and both of them are worse.

The first is the clock. Both windows above assume a retry is something that happens seconds after the failure, because that is what a retry has always been. An agent's relationship with time is not like that. It can pick a task back up after a context compaction, after a process restart, after a handoff to a different agent, after a queue that was backed up overnight. Those are ordinary events in a fleet, and they are measured in minutes to days.

Five minutes does not survive a compaction. Twenty-four hours does not reliably survive a handoff to a run that starts tomorrow. Stripe tells you exactly what you get on the far side: "We generate a new request if a key is reused after the original is pruned." The safety net is real, it is well documented, and agent timescales run off the end of it.

The second is more specific, and I think it is the sharper of the two. Here is Stripe again:

> "The idempotency layer compares incoming parameters to those of the original request and errors if they're not the same to prevent accidental misuse."

Now describe what an agent does with a failed tool call. It reads the error. It forms a hypothesis about what was wrong with the request. It adjusts the arguments and tries again.

That is the behaviour we want from an agent. It is also, exactly and by construction, the thing idempotency keys are built to reject. Reuse the key with the corrected arguments and you get an error rather than the operation. Mint a fresh key to go with the corrected arguments and you have told the system this is a new request, which is the one thing you were trying to avoid claiming — because you still do not know whether the first one landed.

An agent that retries verbatim is covered by the key and constrained to a window. An agent that retries intelligently has stepped outside the mechanism entirely. There is no key discipline that survives a client which edits its own arguments between attempts, and "edits its own arguments between attempts" is a fair one-line definition of what we bought.

## What This Changes About How You Build

None of this argues for fewer agents. It argues for putting the safety somewhere other than the retry.

- **Mint the key when the task is created, not when the call is made.** If the identifier is generated inside the retry helper, it is regenerated on the attempt that most needs it to be stable. Attach it to the unit of work the agent was asked to do, and carry it across restarts and handoffs the same way you carry the task itself.
- **Give the agent a read path for every write path.** RFC 9110's second escape hatch is "some means to detect that the original request was never applied." That is a feature request, not a philosophical position. If an operation matters and has no cheap way to ask whether it already happened, the missing endpoint is the bug.
- **Make the retry a reconciliation, not a counter.** The spec's own example of a client permitted to retry checks state, repairs partial application, and only then tries again. That logic is domain-specific by nature. It belongs in the tool definition, where the domain knowledge is, rather than in the generic wrapper, where it cannot exist.
- **Treat a change of arguments as a new operation, and say so out loud.** The moment an agent edits a request, it is no longer retrying. Naming that in your logs is cheap, and it is the difference between a trace that shows one operation attempted three times and a trace that shows three operations.
- **Do not let a dry run stand as evidence on its own.** A rehearsal tells you what you asked for. If you need to know what happened, the effectful path has to produce its own record — and if the two disagree, the record wins.

The uncomfortable one is the last. A dry run that passes is the most reassuring artifact in the whole loop, and it is the one whose guarantee is thinnest. It was never lying to you. It was answering a narrower question than the one you thought you asked.

## The Line I Would Put in the Runbook

RFC 9110 is not a document about agents. It is a document about clients that make requests they cannot fully observe the consequences of, which is a description of every HTTP client ever written and now happens to be a description of the most autonomous software we ship.

Its answer, across both halves, is the same and it is unfashionable. Safety is not a property of the attempt. It is a property of the preparation. The client that is permitted to retry is the one that knew what it was doing before it started, and the request that can be rehearsed is the one someone deliberately made rehearsable.

So the line is short. You cannot dry-run a side effect. You can only build a system that agreed, ahead of time, to tell you whether one happened.
