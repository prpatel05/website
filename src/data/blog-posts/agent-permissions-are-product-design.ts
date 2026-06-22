import { BlogPost } from "./types";

export const agentPermissionsAreProductDesign: BlogPost = {
  slug: "agent-permissions-are-product-design",
  title: "Agent Permissions Are Product Design",
  subtitle:
    "The next reliable AI workflow starts with deciding what the agent is allowed to touch.",
  date: "2026.06",
  dateISO: "2026-06-23",
  readTime: "6 min",
  tags: ["ai", "agents", "security", "product"],
  image: "/images/blog-copilots-to-colleagues.webp",
  content: `The most important setting in an AI agent is not the model.

It is the boundary.

What can it read? What can it change? Which tools load by default? Which actions need approval? Which systems are simply not in scope?

That used to sound like security plumbing. Necessary, but boring. Something you handled after the product worked.

I think that is backwards now.

Agent permissions are becoming product design.

When a tool can write code, browse the web, operate a browser, run a terminal, call APIs, remember context, trigger workflows, and delegate work to other agents, the permission surface is no longer a back-office detail. It is the shape of the experience. It determines how much the user can trust the agent, how much the agent can do without asking, and how easy it is to understand what happened after the work is done.

This is why I found the recent [Hermes Agent Blank Slate setup](https://hermes-agent.nousresearch.com/docs/getting-started/quickstart) interesting. The feature starts from a minimal agent, then asks you to opt into capabilities instead of quietly loading everything. No web, browser, code execution, vision, memory, delegation, cron, skills, plugins, or MCP servers unless you choose them. The details are specific to Hermes, but the pattern is bigger than one tool.

The default future should be opt-in capability.

Not because agents are useless without access.

Because access is the product.

## Every Tool Changes the Job

It is tempting to describe an agent by its intelligence.

This model is better at reasoning. That one is better at code. This setup has a longer context window. That one has lower latency.

All of that matters, but it misses the operational truth. An agent with no tools is mostly a thinking partner. An agent with file access is a reviewer. An agent with terminal access is a builder. An agent with browser control is a tester. An agent with production API credentials is an operator. An agent with scheduling, memory, and delegation is a process.

Each new permission changes the job you are assigning.

That means each permission should change the product surface too.

If the agent can only read files, the interface can be lightweight. If it can delete data, the interface needs stronger consent. If it can call payment APIs, the workflow needs clear policy and audit trails. If it can install MCP servers, the product needs to explain what those servers expose and what downstream systems they can reach.

The user should not have to reverse engineer the blast radius.

Good products make the boundary visible.

## Defaults Teach Users What Is Safe

Defaults are not neutral.

When an agent ships with every tool enabled, it teaches the user that broad access is normal. When it starts locked down and asks for capabilities as the task needs them, it teaches a different habit: grant the smallest useful permission, then expand only when the work proves it needs more.

That is the AI version of progressive disclosure.

The product does not need to dump a security lecture on the user. It just needs to make the next safe step obvious.

Want the agent to summarize a repo? Read access is enough.

Want it to fix a bug? It needs write access and a test command.

Want it to verify a UI? It needs a browser and maybe a local server.

Want it to publish? That is a different level of trust.

Each step should feel like a deliberate escalation, not a hidden side effect of installing the tool.

This is also where the "power user" argument gets weak. Power users do want speed, but they also want predictability. They do not want to inspect a settings file after every update to see whether new tools appeared. They do not want an agent to gain browser, memory, or plugin access because a vendor decided the new default would be more impressive in a demo.

Fast is good.

Predictable is better.

## MCP Makes This More Urgent

The Model Context Protocol made agent tooling feel composable. That is useful. It also means capability can spread quickly.

An MCP server can expose data, tools, prompts, and workflows through a standard interface. That makes it easier to connect agents to real systems. It also creates a new class of product question: when the agent connects to a server, what exactly did it gain?

The official [MCP security guidance](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices) focuses on things like consent, token handling, confused deputy risks, session security, and scope minimization. The [authorization draft](https://modelcontextprotocol.io/specification/draft/basic/authorization) also pushes clients toward least-privilege scope selection and step-up authorization when more access is needed.

That language sounds technical because the implementation is technical.

But the user experience problem is plain.

Do not make users approve a black box.

If an agent is connecting to a GitHub MCP server, the user should know whether the agent can read public repos, read private repos, open issues, create branches, push code, or trigger workflow runs. Those are different permissions. They deserve different consent, different defaults, and different review paths.

The [NSA's May 2026 MCP security guidance](https://www.nsa.gov/Portals/75/documents/Cybersecurity/CSI_MCP_SECURITY.pdf?ver=bmgiSbNQLP6Z_GiWtRt6bg%3D%3D) makes the broader point: as MCP adoption spreads into production workflows, the security model needs implementation rigor and clearer boundaries. That is not just a warning for security teams. It is a design brief for everyone building agent products.

The product has to translate capability into judgment.

## The Best Permission UI Is Operational

Most permission screens are bad because they are abstract.

They ask for access to "files" or "tools" or "workspace resources" without explaining what the user is actually trying to do. The result is a familiar consent problem: users click approve because the product blocks progress, not because the decision is meaningful.

Agent products can do better because the agent usually has a task.

Tie permissions to the task.

"To update this blog post, I need write access to src/data/blog-posts and permission to run the focused data test."

That is useful.

"To debug this failed checkout flow, I need browser control, local server access, and permission to edit files under src/pages and src/components."

That is useful too.

The permission request should name the outcome, the resources, the action level, and the proof the agent will leave behind. If the agent asks for more access later, it should explain what changed.

This turns permissioning from a modal into part of the workflow.

The boundary becomes inspectable.

## Capability Should Expire

One subtle mistake in agent design is treating permissions as permanent identity.

Humans log into a tool and keep their access. That works because organizations have identity systems, managers, offboarding processes, and audit policies. Even then, stale access is a constant problem.

Agents make stale access worse because their work is often task-shaped.

An agent may need write access to a repo for one bug fix. It may need a browser for one QA pass. It may need a calendar integration for one scheduling task. That does not mean it should keep those capabilities forever.

The better default is task-scoped access.

Grant the capability for this run. Record why it was granted. Revoke it when the task completes. Ask again if the next task needs it.

That may sound slower, but it creates a cleaner mental model. The user stops thinking, "This agent has my environment." They start thinking, "This task has these capabilities."

That is a safer product.

It is also a clearer one.

## Trust Comes From Boring Boundaries

The AI demos that get attention usually show an agent doing a lot.

It opens tools. It clicks around. It writes code. It sends messages. It books things. It looks alive.

The workflows that survive in real teams will be more boring.

They will show exactly what the agent can touch. They will keep destructive actions behind approval. They will separate read from write. They will make capability changes visible in review. They will log the actual tool calls. They will make it easy to replay why the agent did something.

That is not anti-autonomy.

That is how autonomy becomes usable.

If I cannot tell what an agent was allowed to do, I cannot trust what it did. If I cannot see when its permissions changed, I cannot review the work responsibly. If every task starts with broad access, I have to treat every task as high risk.

Good boundaries lower the review burden.

They make the agent's work smaller, clearer, and easier to approve.

## Builders Should Design the Permission Ladder

If you are building agent workflows, I would start with a simple exercise.

Write down the permission ladder for your product.

Not the settings page. The ladder.

What can the agent do with no access? What can it do with read access? What can it do with write access? What requires browser control? What requires network access? What requires external credentials? What requires human approval every time?

Then design the product around those steps.

Make the first step useful. Make escalation contextual. Make dangerous capabilities rare and visible. Make revocation normal. Make the audit trail part of the happy path.

The goal is not to scare users away from powerful agents.

The goal is to make power legible.

The best agent products will not be the ones that ask for everything up front. They will be the ones that earn access as the work demands it.

## The Bottom Line

Agents are becoming capable enough that permissions can no longer be treated as a checkbox in settings.

Permissions define the work. They shape the user's trust. They decide whether an agent feels like a helpful operator or an unpredictable process with too much reach.

The next generation of AI workflow tools will compete on models, speed, integrations, and UX polish. But underneath all of that, the real product question will be simple:

What can the agent touch, and why?

Answer that well, and the agent feels powerful.

Answer it poorly, and every new capability becomes another reason to hesitate.`,
};
