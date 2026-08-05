You spent three weeks choosing an orchestration framework. You read the comparison posts, argued about decorators versus graphs, ran two spikes, and finally landed on one.

You spent about ten minutes choosing the shape of the system it would run.

That ratio is backwards, and there is now enough measured evidence to say so precisely. The framework decides what your code looks like. The shape decides what happens when one agent produces one wrong message — whether that stays a local annoyance or takes down the run.

## The Biggest Failure Category Is the One You Didn't Design

The [MAST taxonomy](https://arxiv.org/abs/2503.13657) sorts 1,642 annotated multi-agent execution traces into three categories. The largest is not the model being dumb, and it is not agents miscommunicating.

**System design issues account for 44.2% of observed failures.** Inter-agent misalignment is 32.3%; task verification is 23.5%. The single biggest bucket is decisions somebody made — or didn't make — about how the system was put together.

Open that category and the sub-modes are uncomfortably familiar:

- **Step repetition — 15.7%.** The system does the same work twice because nothing in the structure said who owned it.
- **Unaware of termination conditions — 12.4%.** Nobody encoded what "done" means, so the system doesn't stop, or stops early.
- **Disobey task specification — 11.8%.** The original constraints stopped being load-bearing somewhere in the middle.

None of those are model-capability problems. You cannot prompt your way out of "two agents both think they own this step." The paper's own framing is blunt: failures "often stem from system design issues, not just LLM limitations or simple prompt following, and require more than superficial fixes, thereby highlighting the need for structural MAS redesigns."

Structural. Not better instructions. Structure.

## Your System Already Has a Shape

Here is the part worth internalizing: you have a topology whether you chose one or not. Pick a framework and you inherit its default shape, usually without a meeting about it.

[From Spark to Fire](https://arxiv.org/abs/2603.04474) (Xie et al., 2026) evaluates six mainstream frameworks and does the grouping for us:

- **Chain** — LangChain, MetaGPT. Work moves down a line.
- **Mesh** — AutoGen, CAMEL. Agents talk to each other more or less freely.
- **Star** — CrewAI, LangGraph. A supervisor sits in the middle and everything routes through it.

These are not marketing categories. They are different answers to one question: when an agent produces a bad message, how many other agents see it before anyone notices?

## Blast Radius Is a Measurable Property

The Spark paper injects a single plausible-but-wrong message — an outdated data-source migration notice — into a system and watches how far it spreads. The result for the two star-topology frameworks is the number I would put on a slide:

- **LangGraph** — inject at the hub and 100.0% of the system fails. Inject the same error at a leaf and it reaches 9.7%. Impact factor: **10.31×**.
- **CrewAI** — hub injection 100.0%, leaf injection 15.9%. Impact factor: **6.29×**.

Same error. Same system. Different entry point. Ten times the damage.

The paper's wording: "LangGraph exhibits extreme fragility at the central hub, where injection causes 100% system-wide failure. Injection at a leaf node is limited to 9.7%, confirming the Supervisor functions as a strict informational cut-set."

Be precise about what this does and does not say. Only the two star frameworks appear in that comparison, because a hub is a thing only star topologies have — chain and mesh have no equivalent coordinate to inject at. This is not a benchmark ranking star below chain. It says something more useful: **a supervisor is simultaneously your best control point and your worst single point of failure**, and those are the same node. The property that makes it able to enforce a contract on every message is the property that lets one bad message reach everything.

Two more findings from the same work are worth carrying:

**Reviewer roles are not a fix.** Five of six frameworks reached 100% final infection rates, including systems with explicit reviewer or QA agents. Adding a critic to a shape that propagates errors gives you a critic downstream of the propagation.

**Correction gets more expensive the longer you wait.** The paper measures accumulated contextual debt: intervene at round two and you're undoing about one round of polluted history; wait until round six and it's 3.9. Injecting a falsehood is cheap. Removing it is not, and the price rises while you're not looking.

## The Shape Change Outperformed the Prompt Change

Here is the experiment that makes this concrete, and it's in the MAST paper rather than a vendor blog.

The researchers took ChatDev and tried two interventions on the same system, same model, same tasks. The first was a prompt fix: refining role-specific prompts to enforce hierarchy, so that only superior agents can finalize a conversation. The second was a shape fix: changing the topology from a directed acyclic graph to a cyclic one, terminating only when the CTO agent confirms all reviews are satisfied, with an iteration cutoff to prevent infinite loops.

On ProgramDev-v0, a custom 32-task set, the accuracies went:

- **Baseline — 25.0.** The system as shipped.
- **Improved prompt — 34.4.** Better instructions, same shape.
- **New topology — 40.6.** Same instructions, different shape.

The shape change beat the prompt change on the same system. That is this post's argument, measured, by people who were not trying to prove it.

Now the honest part, because this blog's only real asset is that its numbers survive being checked.

Those are **percentage points off a very low baseline** — 25 to 41, not "+15.6%" as a relative gain. On HumanEval, which was already near ceiling, the same change moves things 89.6 to 91.5. Barely anything. And the authors ran the same pair of interventions on a second framework, AG2, where on raw accuracy the *prompt* fix won and the topology change didn't.

So where does their conclusion come from? Not from those accuracy numbers. When they look past task completion to the failure-mode distribution, they write that "topology-based changes are more effective than prompt-based changes for both systems." The claim is about which failures disappear, not which score is highest. That is a real result and a narrower one than the headline number suggests.

The authors also deflate their own work, and I'll quote it rather than bury it: "even though our interventions are successful in improving the performance of the framework in different tasks, they do not constitute substantial improvements."

Good. Shape is not a magic lever either. It is the lever nobody is pulling.

## Different Shapes Fail Differently

The most practically useful finding is what happens when you run two differently-shaped systems on the *same* benchmark. Comparing MetaGPT and ChatDev on ProgramDev, MAST finds MetaGPT has 60–68% less failure in system design and inter-agent misalignment — but **1.56× more task-verification failure**.

It didn't fail less. It failed somewhere else.

That is the whole decision in one line, and the paper draws the obvious conclusion: "there is no one-size-fits-all solution to MAS failures." Choosing a shape is choosing which category of failure you're going to spend your time on. Chains lose information at each hop and derail quietly. Meshes let errors compound through multi-neighbor exposure, where mentions from several upstream agents reinforce rather than cancel. Stars give you one place to enforce every contract and one place to lose everything.

Pick deliberately, and you get to build defenses for the failure mode you signed up for.

## How to Actually Pick

Before the framework, answer four questions:

**What's the blast radius of one bad message?** Trace it by hand. If the answer is "everything downstream," you have a hub, and it needs the strictest validation in the system.

**Where's the cut-set?** A supervisor is an informational choke point. That's a liability by default and an asset if you use it — it is the one place where validating every message costs you one implementation instead of N.

**When does this stop?** Termination is 12.4% of failures on its own. The ChatDev result is essentially a termination fix wearing a topology costume: the win came from making "done" conditional on an explicit confirmation instead of on reaching the end of a graph.

**Which failure class can you afford?** You are trading between design failures, coordination failures, and verification failures. Decide which one your team is equipped to catch — then design the shape around that answer rather than discovering it in production.

None of this requires committing to a framework. All of it is easier to change on a whiteboard than in month four.

## The Market Is Arriving at the Same Place

Forrester's Leslie Joseph [polled 47 tech vendors in February 2026](https://www.forrester.com/blogs/agent-control-planes-still-need-a-robust-standards-stack/): 79% recognize agent control planes as a meaningful and distinct product category, 92% have assigned a named product manager or team to it, and 40% report active RFPs explicitly requesting one.

Read that carefully — these are **vendors, not enterprises**. It is a supply-side signal from 47 companies, and it tells you what is being built and sold, not what is deployed. But it is directionally interesting: the industry is converging on the idea that the coordination layer is a product surface of its own, not an implementation detail of whichever framework you imported.

Which is the same claim as this post, arriving from the commercial side.

## The Shape Is the Architecture

Your framework choice determines what your code looks like. Your shape determines what your failures look like, how far one of them travels, and how expensive it is to catch.

One of those is a three-week decision, and it's the wrong one. Go look at your system and draw it — actually draw it, boxes and arrows. Find the node where injecting one wrong sentence takes down the run. That node is your architecture, and if you can't point at it, you didn't choose it.

You still have a shape. Somebody just picked it for you, and it was probably the framework's default.

If you want the observability to see any of this happening while it happens, that's the argument in [Trust Comes From the Trace](/blog/trust-comes-from-the-trace/). And if your errors are entering at the seams between agents rather than at a hub, start with [The Handoff Is Where Agents Break](/blog/the-handoff-is-where-agents-break/).
