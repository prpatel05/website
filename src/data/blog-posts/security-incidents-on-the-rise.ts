import { BlogPost } from "./types";

export const securityIncidentsOnTheRise: BlogPost = {
  slug: "security-incidents-on-the-rise",
  title: "Security Incidents on the Rise: Is Vibe Coding the Common Thread?",
  subtitle:
    "As AI-generated code floods production, the security bills are starting to come due",
  date: "2026.04",
  dateISO: "2026-04-25",
  readTime: "7 min",
  tags: ["security", "ai", "engineering"],
  image: "/images/blog-security-incidents.webp",
  content: `April 2026 has been a brutal month for cybersecurity. Vercel confirmed a breach tied to a compromised AI tool. Drift Protocol lost $285 million in twelve minutes. Kelp DAO was exploited for $292 million, leaving Aave with over $200 million in bad debt. And those are just the headlines.

Something feels different about this wave of incidents. Not just the scale — we've seen big numbers before — but the **pattern**. A growing number of breaches trace back to code that was shipped fast, reviewed lightly, and built with AI assistance. The security community is starting to ask an uncomfortable question: is the vibe coding revolution creating a generation of applications that are fundamentally less secure?

I've been thinking about this a lot. As someone who builds with AI tools daily and writes about the experience, I can't ignore the data anymore.

## The Numbers Are Stark 📊

Let's start with what we know. According to recent research, AI code generators produce vulnerabilities at roughly **2x the rate** of human-written code. A Veracode analysis of 4 million code scans found that AI-generated code contained security flaws **45% of the time**. The Cloud Security Alliance puts that number even higher — 62% in their study.

And the trend is accelerating. In January 2026, six new CVE entries were directly attributed to AI-generated code. By February, it was fifteen. By March, **thirty-five**. Georgia Tech researchers estimate the real number could be five to ten times what's currently being detected — roughly 400 to 700 cases across the open-source ecosystem.

Meanwhile, 46% of all code on GitHub is now AI-generated. The vibe coding market hit $4.7 billion in 2026. We're shipping more AI-written code into production than ever before, and the vulnerability surface is expanding with it.

## Anatomy of April's Worst Month 💥

Let's look at what actually happened this month, because the details matter more than the dollar figures.

### Vercel: When Your AI Tool Becomes the Attack Vector

Vercel's breach didn't come from a zero-day or a sophisticated protocol exploit. It came from a **third-party AI tool**. An employee signed up for an AI productivity suite called Context.ai using their Vercel enterprise account and granted it "Allow All" OAuth permissions. When Context.ai was compromised, the attackers walked right into Vercel's Google Workspace through that OAuth token.

This is the new attack surface that nobody's talking about enough. Engineers are adopting AI tools at breakneck speed — browser extensions, coding assistants, AI office suites — and each one is a potential entry point. The Vercel breach wasn't about bad code. It was about the **toolchain sprawl** that comes with an AI-everything culture.

### Drift Protocol: $285 Million in Twelve Minutes

On April 1st — yes, April Fool's Day — attackers drained $285 million from Drift Protocol on Solana. The method was audacious: they manufactured a completely fictitious token called CarbonVote, seeded it with a few thousand dollars in fake liquidity, and Drift's oracles treated it as legitimate collateral worth hundreds of millions.

The staging began weeks earlier. On-chain forensics traced the initial funding to a Tornado Cash withdrawal on March 11th, with movement patterns consistent with DPRK-attributed operations. The attack executed in roughly twelve minutes, with most stolen funds bridged to Ethereum within hours.

The deeper question: how did a fabricated token bypass validation? The answer likely involves the same pattern we see across the industry — systems built for speed, with security assumptions that went unquestioned because the code "worked" and the tests passed.

### Kelp DAO and Aave: The $292 Million Cascade

On April 18th, an attacker exploited Kelp DAO's bridge infrastructure to release 116,500 unbacked rsETH tokens — about 18% of the token's circulating supply. These phantom tokens were immediately deposited into Aave as collateral to borrow real assets.

The cascade was devastating. Aave's total value locked plunged by $6.6 billion. The AAVE token dropped 16%. Whales pulled more than $6 billion in 24 hours, pushing major lending pools to 100% utilization and effectively trapping remaining depositors.

Again, Aave's own contracts weren't compromised. The vulnerability existed in the **integration layer** — the assumptions about what constitutes valid collateral. These are exactly the kinds of assumptions that get lost when code is generated fast and reviewed at the surface level.

## The Vibe Coding Problem 🎯

Here's the uncomfortable truth about vibe coding: it fundamentally breaks traditional application security models.

The term "vibe coding," coined by Andrej Karpathy, describes a development approach where you describe what you want and let AI generate the implementation. The philosophy prioritizes speed and rapid iteration. Ship fast, fix later. The vibes are good. The code compiles. The tests pass. Deploy.

But security isn't about whether code compiles. It's about whether code **fails safely** under adversarial conditions. And that requires a kind of paranoid, defensive thinking that AI code generators simply don't exhibit by default.

The most common vulnerabilities in vibe-coded applications are telling:

- **Disabled row-level security** — found in roughly 70% of apps built with AI-first platforms
- **Leaked secrets** — API keys and credentials hardcoded or exposed in client bundles
- **Missing webhook verification** — endpoints that accept any payload without signature checks
- **Absent authorization checks** — the classic CWE-862, where endpoints work but don't verify who's asking

These aren't exotic attack vectors. They're **Security 101 failures** — the kind that a human developer with a few years of experience would catch instinctively, but that an AI code generator will happily produce because the code technically fulfills the functional requirement.

## The Moltbook Cautionary Tale 🚨

Perhaps no incident better illustrates the risk than Moltbook, an AI social network whose founder publicly stated he "didn't write a single line of code." The entire application was vibe-coded.

Within three days of launch, security researchers discovered the application had exposed its **entire production database** — 1.5 million API authentication tokens, 35,000 email addresses, and private messages. All publicly accessible. No authentication required.

Moltbook is what happens when the entire security posture of an application depends on an AI code generator that optimizes for functionality, not defense. The app worked. Users could sign up, post, and interact. The vibes were immaculate. The security was nonexistent.

## Speed vs. Insight: The Real Trade-Off ⚖️

I want to be clear: I'm not anti-AI coding. I use AI tools every day and I've written about how they've made me more productive. The issue isn't AI assistance itself — it's the **absence of human security judgment** in the loop.

When an experienced engineer writes code, they bring accumulated knowledge about failure modes. They know that an API endpoint needs rate limiting because they've seen what happens without it. They add input validation not because the spec says to, but because they've been burned by SQL injection before. They check authorization on every endpoint because they understand that "the frontend handles it" is not a security strategy.

AI code generators don't have this scar tissue. They produce code that matches the pattern of what was requested, but they don't anticipate how that code might be **abused**. And when developers accept that code without applying their own security judgment — when they vibe with it instead of scrutinizing it — the defensive layer disappears entirely.

The trade-off isn't speed vs. security. It's **speed vs. insight**. And right now, the industry is overwhelmingly choosing speed.

## What Needs to Change 🔧

The answer isn't to stop using AI coding tools. That ship has sailed — 46% of GitHub is already AI-generated. The answer is to build security back into the workflow in ways that work alongside AI-assisted development.

**First, treat AI-generated code as untrusted input.** Every line should pass through the same scrutiny you'd give to a dependency from an unknown source. Static analysis, secret scanning, and authorization audits should run automatically on every commit, not as a manual step that gets skipped when velocity is the priority.

**Second, keep a human in the security loop.** Code review for AI-generated code should specifically focus on security assumptions — authentication, authorization, input validation, error handling, data exposure. These are the areas where AI consistently underperforms.

**Third, audit your AI toolchain.** The Vercel breach wasn't about code — it was about the tools around the code. Every AI tool your team adopts is a potential attack surface. OAuth permissions should be reviewed. Third-party integrations should be inventoried. The convenience of "Allow All" permissions is the enemy of security.

**Fourth, invest in security education that acknowledges the AI reality.** Developers need to understand not just how to use AI tools, but where those tools have systematic blind spots. Security training needs to evolve from "how to write secure code" to "how to verify that AI-generated code is secure."

## The Stakes Are Only Getting Higher 📈

We're at an inflection point. The volume of AI-generated code in production is growing exponentially. The sophistication of attackers — including nation-state actors like the DPRK group behind the Drift exploit — isn't slowing down. And the gap between "code that works" and "code that's secure" is widening as AI makes it easier than ever to ship the former without achieving the latter.

April 2026 should be a wake-up call. Not because AI coding tools are inherently dangerous, but because we're adopting them faster than we're adapting our security practices to account for their limitations. The vibes might be good, but the threat model doesn't care about vibes.

The question isn't whether AI-assisted development will continue — it will. The question is whether we'll build the security culture and tooling to match the pace of adoption. Right now, the scoreboard says we're losing.`,
};
