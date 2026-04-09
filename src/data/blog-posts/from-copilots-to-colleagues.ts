import { BlogPost } from "./types";

export const fromCopilotsToColleagues: BlogPost = {
  slug: "from-copilots-to-colleagues",
  title: "From Co-Pilots to Colleagues: How AI Agents Changed My Engineering Workflow",
  subtitle: "A year of working alongside AI teammates reshaped how I think about building software",
  date: "2026.04",
  dateISO: "2026-04-05",
  readTime: "6 min",
  tags: ["ai", "engineering", "productivity"],
  image: "/images/blog-copilots-to-colleagues.webp",
  content: `A little over a year ago, I wrote about my first experience using **Devin AI** as a coding co-pilot. The takeaway was clear: AI wasn't replacing engineers, but it was becoming a surprisingly capable junior teammate. Fast forward to today, and that framing already feels quaint. The AI agents I work with now aren't co-pilots. They're closer to **colleagues**.

What changed, what I got wrong, and what I've learned building software alongside AI agents in 2026.

## The Shift: From Autocomplete to Autonomy 🔄

When I first started using AI coding tools, the mental model was simple: **I think, it types**. Copilot-style tools predicted the next line. I was still the driver. The AI was a fancy autocomplete engine that occasionally read my mind.

The agents I use today operate differently. I describe a problem, point them at the relevant code, and they go figure it out. They read documentation, explore the codebase, draft a plan, write the implementation, run the tests, and open a PR. Sometimes they even catch edge cases I didn't think of.

The biggest mental shift wasn't learning new tools. It was learning to **delegate**. And delegation, it turns out, is a skill that most engineers never had to practice with machines before.

## What I Got Wrong Last Year 🤔

In my Devin AI post, I framed the value proposition as a time trade-off: 15 minutes of my own coding vs. 1 hour with Devin. That math was real, but the conclusion I drew was too narrow. I was measuring the wrong thing.

The real value isn't "did this specific task get done faster?" It's **"what did I do with the time I didn't spend on it?"** When I stopped measuring AI by how fast it could do _my_ tasks and started measuring it by how much it expanded _my capacity_, the picture changed dramatically.

These days, I routinely have two or three agent sessions running in parallel while I focus on architecture decisions, stakeholder conversations, or code review. My throughput hasn't just increased. It's **qualitatively different**. I spend more time on the problems that actually need a human brain, and less time on the ones that don't.

## The Trust Calibration Problem ⚖️

Nobody warns you about this part. **Trust is harder than prompting**.

Early on, I over-trusted. I'd skim an AI-generated PR, approve it, and move on. Then I'd find a subtle bug two days later, something that passed tests but violated an unwritten assumption about how our system handles state. The AI didn't know our system's history. It only knew the code as it existed on disk.

Then I over-corrected. I reviewed AI PRs with more scrutiny than I'd give a senior engineer's code. That defeated the entire purpose. I was spending _more_ time reviewing than I would have spent just writing the code myself.

The sweet spot (and every engineer working with agents has to find their own) is what I call **calibrated trust**:

- **High trust** for well-defined, well-tested tasks: CRUD endpoints, data transformations, boilerplate setup, migrations with clear schemas
- **Medium trust** for tasks that require domain context: business logic, API integrations, anything touching auth or payments
- **Low trust** for tasks involving system design, performance-sensitive code, or subtle correctness requirements

This isn't that different from how you'd calibrate trust with a human teammate. The difference is that AI agents are **consistently good at their strengths and consistently blind to their weaknesses**. Humans are more variable but also more self-aware. Once you internalize that pattern, the collaboration gets much smoother.

## Three Habits That Made the Difference 🛠️

After a year of iteration, three practices made my AI-augmented workflow actually _work_:

### 1. Write Better Context, Not Better Prompts

The prompt engineering hype was overblown. What actually matters is **context**. AI agents do better work when they have access to clear documentation, well-named functions, and explicit conventions. Every time I improved our codebase's readability for humans, the AI agents got better too.

The irony isn't lost on me: the best way to make AI productive is to make your codebase better for _everyone_.

### 2. Review the Plan, Not Just the Code

Most AI agent tools now show you a plan before they start coding. I used to skip this step. Now it's the most valuable part of the process. Catching a wrong assumption at the plan stage saves 10x the time compared to catching it in code review.

When I review an agent's plan, I'm asking: _Does this agent understand the problem the way I do?_ If the answer is no, I course-correct before a single line of code gets written.

### 3. Keep a Human in the Architecture Loop

AI agents are great at implementing within a well-defined boundary. They're not great at deciding where the boundary should be. Architectural decisions, where does this logic live, how do these services communicate, what are the failure modes, still need human judgment.

I've settled into a rhythm: I make the structural decisions, the agents fill in the implementation, and I review the result. It's not unlike being a tech lead, except my "team" never gets tired and never has opinions about tabs vs. spaces.

## Where This Goes Next 🔮

The pace of improvement in AI agents is staggering. A year ago, getting an agent to handle a multi-file refactor reliably felt like a stretch. Now it's routine. The frontier is moving toward agents that can maintain context across longer arcs of work, understanding not just the current task but the _project trajectory_.

I'm also seeing more teams adopt agents not as individual tools but as **team members with defined roles**: one agent handles test coverage, another manages dependency updates, another writes documentation. The multi-agent workflow is still early, but the pattern is emerging.

The engineers who thrive won't be the fastest coders. They'll be the ones who can **orchestrate, review, and architect**, the skills that have always defined senior engineering, now amplified by a new kind of teammate.

## What It Actually Taught Me 🎯

Working with AI agents for the past year taught me something I didn't expect: it made me a **better engineer**, not because the AI wrote my code, but because it forced me to think more clearly about what I actually wanted built. You can't delegate effectively if you don't understand the problem deeply yourself.

AI agents aren't replacing engineers. They're raising the bar for what "engineering" means. Less time typing. More time thinking.

And honestly? I wouldn't go back. The way I work now, with AI colleagues running alongside me, feels like how software was always meant to be built. We just didn't have the teammates for it until now.`,
};
