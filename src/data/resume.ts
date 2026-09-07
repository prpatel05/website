/**
 * Resume content for the HTML `/resume/` page.
 *
 * Keep this aligned with `public/resume.pdf`. Do not invent employers, dates,
 * founder credit, or metrics.
 */

export const resumeMeta = {
  name: "Pratik Patel",
  headline:
    "Chief Architect | AI Agents · Platforms · Cloud | 3x Company Builder",
  location: "Washington, DC (Open to Remote)",
  email: "pratik@pa.tel",
  phone: "(518) 636-9399",
  phoneHref: "tel:+15186369399",
  emailHref: "mailto:pratik@pa.tel",
  site: "https://pratik.pa.tel",
  links: [
    { label: "pa.tel", href: "https://pratik.pa.tel" },
    { label: "linkedin.com/in/prpatel05", href: "https://www.linkedin.com/in/prpatel05/" },
    { label: "x.com/prpatel05", href: "https://x.com/prpatel05" },
    { label: "github.com/prpatel05", href: "https://github.com/prpatel05" },
  ],
} as const;

export const executiveSummary = [
  "Chief Architect for Bounded and OpenApps — building the full-stack AI agent app builder and policy-enforced runtime that lets coding agents ship real apps with verify/deploy gates, data boundaries, auth, functions, realtime, payments, and hosting.",
  "Three-time company builder: grew a 30-person engineering org at AWS, co-founded and sold a blockchain studio via acquisition by Dapper Labs, and took a healthtech startup from napkin sketch to 50K+ users as founding CTO.",
  "Hands-on platform architect who sets technical strategy, ships the hard seams himself, and partners with founders and investors as the primary technical voice.",
] as const;

export type ResumeOrgLink = {
  label: string;
  href: string;
};

export type ResumeRole = {
  title: string;
  org: string;
  dates: string;
  blurb: string;
  bullets: readonly string[];
  orgLinks?: readonly ResumeOrgLink[];
};

export const experience: readonly ResumeRole[] = [
  {
    title: "Chief Architect",
    org: "Bounded · OpenApps",
    dates: "Aug 2025 – Present",
    blurb:
      "Full-stack AI agent platforms — Bounded runs what agents build; OpenApps hosts autonomously run, openly governed apps on that runtime. Light lineage: OpenApps evolved from Poof; Bounded is the agent-era full-stack runtime (same team continuity).",
    orgLinks: [
      { label: "bounded.sh", href: "https://bounded.sh" },
      { label: "openapps.xyz", href: "https://openapps.xyz" },
    ],
    bullets: [
      "Own the full-stack architecture for Bounded: agent app builder plus policy-enforced runtime spanning verify/deploy gates, data boundaries and invariants, auth, data/files, server functions, realtime/live state, payments, and hosting.",
      "Design the agent–runtime contract so coding agents (Claude Code, Codex, and peers) can build while Bounded enforces declared boundaries — refused writes, watched/approved routed actions, and deploy gates that keep apps safe to iterate.",
      "Carry platform foundations forward into the Bounded era: multi-tenant isolation, deployment and edge path (including cold-start work that cut sandbox starts ~60% and supported 5K+ concurrent sessions), agent/MCP test harnesses, and multi-LLM routing by task complexity.",
      "Serve as primary technical voice for architecture, roadmap, and infrastructure cost model across Bounded and OpenApps (alliance-backed apps that outlive their makers — hosted on Bounded).",
    ],
  },
  {
    title: "Chief Technology Officer",
    org: "eddii",
    dates: "May 2023 – Aug 2025 (Advisor to Dec 2025)",
    blurb:
      "Seed-stage healthtech — AI-powered diabetes management — sole technical executive — team of 6",
    bullets: [
      "Sole C-level technology leader: defined product and tech strategy, architected the HIPAA-compliant platform from scratch, and delivered on time and 20% under budget.",
      "Scaled to 50K+ users in under 12 months; forged provider and insurer partnerships for clinical integration.",
      "Led AI/ML strategy (LLM health insights chatbot; +35% daily active usage in 6 months) and investor-facing technical narrative that helped close $3.5M across rounds.",
    ],
  },
  {
    title: "Co-Founder & CTO → Senior Software Engineer II",
    org: "Dapper Labs (via Acq. of Zay Codes)",
    dates: "Jun 2021 – May 2023",
    blurb:
      "Co-founded blockchain studio — acquired by Dapper Labs — retained to lead technical integration — team of 15",
    bullets: [
      "Co-founded the company, recruited a 15-person engineering team, and shipped production Flow dApps across 5 client contracts.",
      "Led P&L and acquisition workstreams end-to-end through the successful acqui-hire by Dapper Labs.",
      "Built the NFT Catalog (community standard) and the Instagram API integration for Flow-based NFTs; mentored engineers as smart-contract SME post-acquisition.",
    ],
  },
  {
    title: "Senior SDE → Lead, Proactive Security",
    org: "Amazon Web Services",
    dates: "Jan 2015 – Mar 2022",
    blurb:
      "Built and led a new security organization — 4 teams, 30+ engineers; helped scale the broader org from 10 to 100+ engineers",
    bullets: [
      "Hand-picked to build a security engineering org from scratch: recruited and led 30+ engineers across 4 teams and owned org-wide automation delivery.",
      "Shipped fuzzing and API-model-driven security testing covering 15K+ AWS public APIs; injected automated security review into the SDLC to accelerate service launches.",
      "Designed a web-based SSH client adopted by 15K+ daily users and an account platform handling 50K daily users at 300+ TPS; drove SSO/MFA for 1.5M+ Amazon employees.",
    ],
  },
] as const;

export const skillGroups = [
  {
    label: "Languages",
    items: "TypeScript, JavaScript, Python, Go, Bash",
  },
  {
    label: "Frameworks & Runtime",
    items: "React, Next.js, Node.js, Bun, Playwright",
  },
  {
    label: "Cloud & Infrastructure",
    items: "AWS, Docker, Terraform, Cloudflare Workers, CI/CD",
  },
  {
    label: "AI & Agent Platforms",
    items:
      "LLM integration (Claude, GPT), agentic workflows (MCP, Claude Code), eval harnesses, multi-model routing, RAG",
  },
  {
    label: "Architecture",
    items:
      "Platform engineering, multi-tenant SaaS, distributed systems, realtime, security engineering, API-first design",
  },
  {
    label: "Leadership",
    items:
      "Technical strategy & roadmapping, org building, M&A technical diligence, investor-facing architecture narrative",
  },
] as const;

export const education = {
  degree: "M.S., Computer Science & Computer Engineering (Dual Major)",
  school: "Rensselaer Polytechnic Institute",
  notes: "GPA: 3.8 | Dean's List | RPI Medalist",
} as const;

export const publications = [
  {
    title: "Vibe Check",
    text: "Open-source TypeScript framework for testing and evaluating AI agent workflows (github.com/poofdotnew/vibe-check). Originated as Tarobase-era internal tooling; released to the community.",
  },
  {
    title: "Developing Elastic Software for the Cloud",
    text: "S. Imai, P. Patel, C. Varela — Encyclopedia of Cloud Computing, Ch. 50, Wiley-IEEE Press, 2016.",
  },
] as const;
