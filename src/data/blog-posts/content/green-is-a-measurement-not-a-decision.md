I keep watching the same meeting. Someone asks if the agent is ready. Someone else shares a dashboard. The suite is green. The conversation ends.

That used to be the right reflex. For a compiler, a passing test suite is close enough to a ship decision that we stopped noticing the gap. Agents broke the reflex and we didn't update the meeting.

[Last month](/blog/your-eval-suite-measures-the-wrong-thing/) I wrote that nearly a quarter of observed multi-agent failures are failures of the checking layer, and that the most common one is the check that ran and said yes. The closer was the part I want to pick up: your eval suite is another component in the system, and unlike everything else you built, there is nothing downstream of it that would notice if it broke.

This week is the next sentence. Even if you fix the suite — even if it starts measuring the right thing — a pass is not permission. Production agents fail in a place the suite was never pointed at. Green is a measurement. Shipping is a judgment. Most teams have quietly handed that judgment to the dashboard.

## The Suite Cannot See the Failure You Will Get Paged For

I have been reading Mukund Pandey's [Evaluating Agentic AI in the Wild](https://arxiv.org/abs/2605.01604). It is a taxonomy of seven failure modes the author argues are specific to agents running continuously, not to models taking a test.

The list is unglamorous, which is why I trust the shape of it. Cascading decision error: an early step is wrong, every later step is locally correct given that input, and the output is internally coherent and systematically false. Silent tool degradation: a dependency starts returning schema-valid stale or partial data instead of failing, the logs stay clean, and downstream logic proceeds at full confidence. Distribution collapse: the agent converges on a narrow set of high-scoring outputs while accuracy stays flat. Cross-surface inconsistency: the same intent arriving through the API and the UI gets two different answers. Explanation decoupling: the decision is right and the reason you recorded is wrong. Latency-driven correctness erosion: the SLA is green because the system skipped the enrichment that made the answer good. Proxy goal convergence: the metric you rewarded went up for weeks while the thing you actually wanted quietly left.

I will not tour the framework the paper proposes. The useful part is the detection table. Against ROUGE, BERTScore, accuracy/AUC, AgentBench, and MT-Bench, **four of the seven modes produce no signal at all**. The other three show up only after a lag of multiple evaluation cycles. No standard metric in that set detects any of them reliably inside a single cycle.

Sit with that. The suite can be honest, well-maintained, and pointed at the right property of the output, and still be blind to the incident you will get paged for. Last month the problem was a verifier that lied. This week the problem is a verifier that was never looking at the room the fire started in.

## Accuracy Can Stay Flat While the System Rots

The paper's most instructive experiment is also the least dramatic.

The author simulates five weekly windows of session outputs. Accuracy is held between 0.86 and 0.88 the entire time — the production pattern where request-level correctness does not reflect what a user experiences across a session. Meanwhile the output distribution narrows from twenty categories to three. Diversity drops by a factor of six and a half. Repeat rate goes to 1.0: every output in the window comes from the same category.

The accuracy number never flinches.

A second experiment does the same trick with tools. Across four stages of an upstream service degrading into partial responses, the external accuracy signal moves by three hundredths. The partial-response rate goes from 4% to 58%. A team watching accuracy would see noise. The system is already shipping on incomplete inputs.

Two caveats, and I want them in the same section as the numbers.

First, these are synthetic traces built to reproduce signatures the author says he observed in production. The paper is explicit: there is no production dataset in the experiments, and the billion-event-scale examples are described without published proprietary metrics. Treat the direction as the finding, not 0.86 or 6.5×.

Second, this is a single-author paper with a proposed framework attached. I am not adopting the framework. I am taking the claim that is cheap to falsify and expensive to ignore: the metrics closest to the model are often the last to notice that the system has changed shape.

That is not a new idea. SRE has been living it for twenty years. Latency SLAs stay green while a fallback path skips the work that made the answer correct. Error rate stays low because the tool stopped erroring and started lying. [Agents fail quietly](/blog/agents-fail-quietly/). The new part is that the quiet failure can live entirely outside the eval you run before you ship, and still be the thing your users hit on day two.

## A Pass Is an Input

We already know how to treat a green suite in every other part of the stack. Unit tests passing is not a production deploy. It is one input to a decision that also includes an error budget, a canary, and a person who is allowed to halt the rollout after the tests said go.

Agent teams inverted that. The suite became the decision. "Evals are green" is how the meeting ends.

That only works if two things are true: the suite can see the failure mode that will page you, and the world the agent runs in is the world the suite was built against. Last month's paper said the first is often false because the check itself is wrong. This week's paper says the first is often false even when the check is right, because the failure is in the coupling — tool health to decision quality, latency to correctness, one step's confidence to the next step's certainty. The second is false the moment the model, the prompt, the index, or the tool changes after you froze the cases.

A snapshot cannot bless a system that keeps moving. Asking it to is how a measurement becomes a ritual.

## Put a Decision After the Check

Last week I wrote that somebody has to own the agent. The empty box on the org chart. That post is about the name. This one is about what that name is for.

An owner without a ship ritual is a name on a page. The suite will still end the meeting, and you will have assigned accountability for a decision nobody actually made.

I don't want to end on a checklist, so let me end on the smallest set of things that would make "evals are green" stop being the last sentence in the room.

**The owner has to be allowed to say no after green.** If the only halt is the suite, you do not have a ship decision. You have an automation. Give them a halt that works after merge, not just before it. I wrote about [reversibility](/blog/give-your-agent-an-undo-button/) as a property of the agent's actions. It is also a property of yours.

**Run something on live traffic that is not the suite.** Shadow, canary, sampled traces — the shape matters less than the fact that it sees the couplings the offline cases cannot. [Trust comes from the trace](/blog/trust-comes-from-the-trace/), and the traces that matter are the ones from the system you actually shipped, including the runs that look fine.

**Watch the successful production runs.** Catching a broken verifier was one reason. Catching a system whose accuracy is flat while its behavior has already narrowed, or whose tools have started returning partials, is the other. By definition no pre-ship alert will route you there.

**Write down what would make you unship.** Not a severity matrix. One sentence: if this is true on Thursday, we turn it off. If you cannot finish that sentence, the suite is doing the deciding, and you have already seen why that is a bad job for it.

## The Bottom Line

You can spend a quarter fixing the eval suite and still ship the incident, because you asked the suite to do a job it cannot do. It can tell you what it saw on the cases you remembered to write. It cannot see the failure that only exists in the coupling between a tool and a decision, or in a distribution that collapsed while accuracy held still. And it cannot be the person in the room who is on the hook.

Green is a measurement.

It is not a decision.
