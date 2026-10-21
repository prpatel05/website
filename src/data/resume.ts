/**
 * Resume content for the HTML `/resume/` page.
 *
 * Keep this aligned with `public/resume.pdf`. Do not invent employers, dates,
 * founder credit, or metrics.
 */

export const resumeMeta = {
  name: "Pratik Patel",
  headline: "CTO & Chief Architect | 3x Startup Builder (1 Exit) | AI Agent Platforms | Ex-AWS Identity & Security",
  location: "Washington, DC (Open to Remote)",
  email: "pratik@pa.tel",
  phone: "(518) 636-9399",
  phoneHref: "tel:+15186369399",
  emailHref: "mailto:pratik@pa.tel",
  site: "https://pratik.pa.tel",
  links: [
    { label: "pratik.pa.tel", href: "https://pratik.pa.tel" },
    { label: "linkedin.com/in/prpatel05", href: "https://www.linkedin.com/in/prpatel05/" },
    { label: "x.com/prpatel05", href: "https://x.com/prpatel05" },
    { label: "github.com/prpatel05", href: "https://github.com/prpatel05" },
  ],
} as const;

export const executiveSummary = [
  "Hands-on Chief Architect on Tarobase's founding team (OpenApps, Bounded, poof.new), leading engineering for the platform where AI coding agents build, verify, deploy, and run production apps; 5K+ apps to date.",
  "3x startup builder with an exit: co-founded a 15-person development studio acquired by Dapper Labs, and as eddii's first CTO rebuilt its HIPAA platform and grew it from ~4K to 50K+ registered users within a year of national launch.",
  "7 years at AWS: architected the SSO/MFA service Amazon's 1.5M+ employees sign in through today, designed authorization for 100K+ AWS accounts, and was founding tech lead of a security org that grew to 100+ engineers.",
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
    org: "Tarobase (OpenApps, Bounded, poof.new)",
    dates: "Aug 2025 - Present",
    blurb:
      "Venture-backed AI agent platform startup. Hired and now lead a ~5-engineer team.",
    orgLinks: [
      { label: "openapps.xyz", href: "https://openapps.xyz" },
      { label: "bounded.sh", href: "https://bounded.sh" },
      { label: "poof.new", href: "https://poof.new" },
    ],
    bullets: [
      "Own agentic platform strategy, full-stack architecture, roadmap, and infrastructure cost model for OpenApps, Bounded, and poof.new: one runtime (auth, data, functions, realtime, payments, hosting) behind 5K+ agent-built apps.",
      "Architecting OpenApps, the company's upcoming flagship: community-owned apps that keep running after their creators step away, hosted on Bounded so the runtime, not the creator, holds every credential.",
      "Designed guardrails for agent-written apps: the runtime enforces declared data boundaries and invariants on every write, and verification fails closed with concrete counterexamples before a bad change deploys.",
      "Cut sandbox cold starts ~60% with a new deployment pipeline and edge caching layer, supporting 5K+ concurrent sessions with multi-tenant isolation.",
      "Reduced LLM spend 25%+ via multi-LLM routing by task complexity, with no drop in production quality metrics.",
      "Built eval harnesses for Claude Code, Codex, and MCP workflows and hill-climbed agent task success on them; co-maintain the Bounded TypeScript SDK (5K+ monthly npm downloads) and CLI.",
    ],
  },
  {
    title: "Chief Technology Officer",
    org: "eddii",
    dates: "May 2023 - Aug 2025",
    blurb:
      "Seed-stage healthtech: gamified, AI-powered diabetes app (Dexcom connected-app partner) and eddii-Care virtual endocrinology clinic. First CTO: set product and technology strategy, hired and led a team of 6, and presented to the board. Advisor through Dec 2025.",
    bullets: [
      "Rebuilt the HIPAA-compliant platform from scratch; launched nationally Dec 2023 on time, 20% under budget.",
      "Grew registered users from ~4K at national launch to 50K+ within 12 months.",
      "Shipped an LLM companion chatbot for emotional support and diabetes coaching to every user, lifting daily active usage 35% within 6 months.",
      "Delivered eddii-Care, the virtual endocrinology clinic, from appointment booking with licensed endocrinologists to the full revenue cycle: insurance eligibility, claims submission, payment posting, and patient billing.",
      "Built the Dexcom continuous glucose monitor (CGM) pipeline behind real-time insights and in-app game features.",
      "Led technical diligence and investor demos that helped raise ~$1.5M; owned the technology budget, all engineering hiring, and the engineering process built from zero (CI/CD, code review, on-call, releases).",
    ],
  },
  {
    title: "Co-Founder and Chief Technology Officer",
    org: "Zay Codes",
    dates: "Jun 2021 - Apr 2022",
    blurb: "Flow blockchain development studio; acquired by Dapper Labs in Apr 2022 (acqui-hire).",
    bullets: [
      "Recruited and managed a 15-person engineering team and landed 5 client contracts to design and ship production apps on the Flow blockchain.",
      "Won $100K+ in hackathon prizes building open-source developer tools, drawing acquisition interest from Dapper Labs.",
      "Owned the P&L and led the exit, negotiating the acquisition by Dapper Labs through close.",
    ],
  },
  {
    title: "Senior Software Engineer II",
    org: "Dapper Labs",
    dates: "Apr 2022 - Jun 2023",
    blurb: "Joined through the acquisition of Zay Codes.",
    bullets: [
      "Led technical integration of the Zay Codes team into Dapper Labs; mentored engineers as the Flow smart-contract subject-matter expert.",
      "Created Flow developer tooling and ran security and design reviews of Flow smart contracts.",
      "Shipped product features for Dapper's consumer apps and helped partner companies integrate with Flow.",
    ],
  },
  {
    title: "Senior Software Development Engineer, Tech Lead",
    org: "Amazon Web Services",
    dates: "Jun 2019 - Mar 2022",
    blurb: "Proactive Security, a new org built to catch security issues before AWS launches.",
    bullets: [
      "Founding tech lead, chosen by VP-level leadership: set the multi-year technical vision and led design across 4 teams (30+ engineers); ran hiring loops as it grew from 10 to 100+ engineers across 20+ teams.",
      "Built API-model-driven fuzzing and security testing across all 15K+ AWS public APIs, replacing hand-written security tests for service launches.",
      "Automated security review inside the AWS SDLC for every service launch, cutting reviews from months to days.",
    ],
  },
  {
    title: "Software Development Engineer",
    org: "Amazon Web Services",
    dates: "Feb 2015 - Jun 2019",
    blurb:
      "Security Tools and Platforms team; promoted twice, SDE I to Senior SDE. Identity and access for Amazon employees and AWS accounts.",
    bullets: [
      "Architected the core enterprise SSO/MFA service Amazon's workforce signs in through (1.5M+ employees today).",
      "Led the rollout of phishing-resistant MFA (FIDO2 hardware security keys) to Amazon's corporate workforce with a zero-downtime cutover.",
      "Designed the authorization model for the business-critical system gating employee access to 100K+ AWS accounts and safety-critical operator actions (50K daily users); hardened it and added audit logging and detection.",
      "Owned reliability for the SSO/MFA and authorization systems, meeting a 99.999% availability SLA.",
      "Designed and launched a browser-based SSH client adopted by 15K+ daily users, with a 4.4/5 satisfaction score.",
    ],
  },
] as const;

export const skillGroups = [
  {
    label: "Leadership",
    items:
      "Technical strategy and roadmaps, hiring and team building, P&L and budgets, investor diligence and demos",
  },
  {
    label: "AI & Agents",
    items:
      "Agentic systems, agent runtimes, guardrails, sandboxing, agent orchestration, Model Context Protocol (MCP), Claude Code, Codex, evals and hill-climbing, multi-model routing, LLM cost control, RAG, LLMs (Claude, GPT)",
  },
  {
    label: "Architecture & Security",
    items:
      "Multi-tenant SaaS platforms, platform engineering, API design, data modeling (SQL, DynamoDB), distributed systems, high availability, observability, developer experience (SDKs, CLIs), identity and access management (IAM), authentication (SSO, MFA, OAuth), authorization, security automation and fuzzing, HIPAA",
  },
  {
    label: "Stack",
    items:
      "TypeScript, Java, React, React Native, Node.js, AWS, Cloudflare Workers (serverless, edge), Terraform, Docker",
  },
] as const;

export const education = [
  { degree: "M.S. Computer Science", school: "Rensselaer Polytechnic Institute" },
  {
    degree: "B.S. Computer Science and Computer & Systems Engineering",
    school: "Rensselaer Polytechnic Institute",
  },
] as const;

export const publications = [
  {
    title: "Developing Elastic Software for the Cloud",
    text: "S. Imai, P. Patel, C. Varela. Encyclopedia of Cloud Computing, Ch. 50, Wiley-IEEE Press, 2016.",
  },
  {
    title: "Essays on AI agents and engineering leadership",
    text: "30+ posts at pratik.pa.tel, 2025-2026.",
  },
] as const;
