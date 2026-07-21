The most important AI security story right now is not that models can find bugs.

It is that models can find more bugs than humans can responsibly process.

That is the part that changes how builders should think about software. For years, security work was constrained by discovery. Could someone find the vulnerability? Could they reproduce it? Could they build an exploit? Could a small team afford enough expert review to catch the important issues before attackers did?

Now that bottleneck is moving.

Anthropic's recent [Project Glasswing update](https://www.anthropic.com/research/glasswing-initial-update) is the clearest signal yet. The company says Claude Mythos Preview and its partners found more than 10,000 high- or critical-severity vulnerabilities across major software systems. In open source alone, Anthropic says it scanned more than 1,000 projects and surfaced thousands of serious findings, with human triage becoming the slow part.

You do not have to take every number at face value to see the shape of the shift.

AI is making vulnerability discovery cheaper. That sounds like good news, and it is. But it also means every software team is about to face a harder question:

**What happens when the scanner is faster than the organization?**

## The Patch Window Is the Product Now

Security used to have a familiar rhythm. A bug was found. A report was filed. A team reproduced it. Someone argued about severity. Someone wrote a patch. Users eventually upgraded.

That process was never fast enough, but it mostly matched the speed of human discovery.

AI breaks that balance.

If models can search codebases, reason about exploit paths, generate reports, and repeat that work across thousands of projects, then finding bugs stops being the scarce skill. The scarce skill becomes the system around the finding:

- Can you tell which reports are real?
- Can you prioritize the ones that actually matter?
- Can you patch without breaking production?
- Can you ship fixes before attackers learn the same thing?
- Can you keep maintainers from drowning in low-quality reports?

That is the new security stack. Not just detection. Response capacity.

A vulnerability that sits untriaged for three weeks is not meaningfully safer because an AI found it. In some cases, it is riskier, because the same class of model may soon make the path to exploitation easier for everyone else.

The patch window is not an operational detail anymore. It is part of the product.

## AI Does Not Remove Security Work

There is a lazy version of the story where AI agents make security easy.

Run the model. Get the report. Apply the patch. Done.

That is not how real systems work.

Real systems are full of tradeoffs. The obvious fix can break an integration. The technically correct fix can create a migration problem. The most severe-looking vulnerability might be unreachable in production, while the boring one in a forgotten admin path is exposed to the internet.

AI can help find and explain these problems. It can write a first patch. It can generate a regression test. It can compare similar code paths and look for variants.

But someone still has to own the decision.

That is the same pattern I keep seeing across AI-assisted building. The manual work shrinks, but the judgment work expands. The operator has to decide what deserves attention, what can wait, what risk is acceptable, and what needs a deeper human review.

Security is just where this becomes impossible to ignore.

## The Dangerous Middle

There is a period we are entering that feels especially unstable.

Eventually, AI should make software much safer. Every serious codebase should have agents continuously searching for vulnerabilities, proposing patches, generating tests, and checking whether fixes actually landed. That world is better than the one we have now.

But the transition is messy.

The discovery side is improving faster than the response side. That creates a gap. More findings, more reports, more possible attack paths, more pressure on teams that already do not have enough security capacity.

This is especially painful for open source.

A large company can assign security engineers, rotate incident response, and fund dedicated tooling. A maintainer with a popular library might be doing all of this after work, for free, while also reviewing feature requests and answering issue comments. Dumping hundreds of AI-generated reports into that maintainer's inbox does not automatically make the ecosystem safer.

It might make it worse unless the reports are high quality, reproducible, prioritized, and paired with patches that are easy to review.

AI security only works if it respects the human throughput on the other side.

## What Builders Should Change Now

If you are building with AI agents, this is not just a cybersecurity industry story. It changes the default operating model for anyone shipping software.

The old advice was "move fast and break things." The AI-era version needs an asterisk:

Move fast, but build a system that can notice what broke.

That means security cannot be a quarterly cleanup pass. It has to live inside the same loop as product work.

### 1. Treat every AI-generated change as reviewable work

AI code should not feel like magic output. It should feel like a pull request from a very fast junior-to-mid-level engineer who sometimes has excellent instincts and sometimes misses the reason the system is shaped the way it is.

Review it. Ask what changed. Ask what assumptions it made. Ask what surfaces it touched. If a change affects auth, payments, permissions, file handling, secrets, user data, or external integrations, slow down.

Fast does not mean casual.

### 2. Make tests prove the risky behavior

AI is good at producing tests that increase coverage and bad at knowing which behavior deserves proof unless you tell it.

For security-sensitive changes, generic tests are not enough. Ask for tests that prove the boundary:

- A user cannot access another user's data
- A disabled feature cannot be invoked through an API path
- A webhook cannot be replayed without detection
- A malformed upload cannot escape its expected directory
- A permission check fails closed, not open

These tests do more than catch regressions. They teach the agent what matters next time.

### 3. Keep a patch lane open

The teams that handle AI-era security well will not be the teams with the most findings. They will be the teams with the shortest path from confirmed issue to shipped fix.

That means knowing who can approve a security patch. Knowing which tests must run. Knowing how to ship a small hotfix without dragging in unrelated product work. Knowing how to communicate a change if users need to update.

If your process requires three meetings to patch a serious bug, AI did not solve your security problem. It just made the backlog visible.

### 4. Build less surface area

The most underrated security feature is not having the feature.

Every integration, admin panel, file parser, OAuth scope, background job, and public endpoint becomes another place where a model can find something interesting. AI makes it easier to build all of that. It also makes it easier to discover what you accidentally exposed.

This is another reason taste matters. Good builders cut surface area. They do not add settings because settings are easy. They do not expose APIs because the model can scaffold them. They ask whether the capability deserves to exist.

The safest code is still the code you never had to ship.

## This Is Why Human Judgment Gets More Valuable

Every time AI makes a technical task cheaper, people assume the human role shrinks.

I think the opposite keeps happening.

When code generation gets cheaper, product judgment matters more. When content generation gets cheaper, taste and distribution matter more. When vulnerability discovery gets cheaper, triage and patch judgment matter more.

The bottleneck moves up the stack.

That is the lesson for builders. Do not measure your AI workflow by how much code it can produce or how many issues it can find. Measure it by how quickly it helps you make good decisions and ship the right fixes.

The future is not "AI finds every bug, so security is solved."

The future is closer to this:

AI finds more than you can handle. The winners are the teams that built the judgment, process, and restraint to handle the right things first.

## The Bottom Line

Project Glasswing is a preview of a much larger shift. Software is entering an era where the cost of finding flaws drops dramatically, while the cost of responsibly fixing them remains stubbornly human.

That is uncomfortable, but it is also useful clarity.

If you are building with AI, do not wait for a security crisis to design your response loop. Review agent-written code like it matters. Test the boundaries. Keep patches small. Reduce surface area. Build a process that can absorb uncomfortable findings without freezing.

AI made bugs cheap to find.

Now the hard part is proving you can fix them.
