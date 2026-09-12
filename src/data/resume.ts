/**
 * Resume content for the HTML `/resume/` page.
 *
 * Keep this aligned with `public/resume.pdf`. Do not invent employers, dates,
 * founder credit, or metrics.
 */

export const resumeMeta = {
  name: "Pratik Patel",
  headline:
    "Chief Architect | AI Agents & Agentic Platforms | Cloud | 3x Company Builder",
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
  "Chief Architect for OpenApps, Bounded, and poof.new. Building AI agent platforms and the policy-enforced agent runtime so coding agents can ship real apps with verify/deploy gates, data boundaries, auth, functions, realtime, payments, and hosting.",
  "Three-time company builder: grew a 30-person engineering org at AWS, co-founded and sold a blockchain studio via acquisition by Dapper Labs, and took a healthtech startup from napkin sketch to 50K+ users as founding CTO.",
  "Hands-on platform architect for agentic systems: set technical strategy, ship the hard parts of the stack, and speak for the architecture with founders and investors.",
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
    org: "OpenApps | Bounded | poof.new",
    dates: "Aug 2025 - Present",
    blurb:
      "Full-stack AI agent platforms. OpenApps hosts autonomously run, openly governed apps that outlive their makers; Bounded is the policy-enforced runtime those apps run on; poof.new is the earlier product line the same team carried forward.",
    orgLinks: [
      { label: "openapps.xyz", href: "https://openapps.xyz" },
      { label: "bounded.sh", href: "https://bounded.sh" },
      { label: "poof.new", href: "https://poof.new" },
    ],
    bullets: [
      "Own the full-stack architecture for Bounded: agent app builder plus policy-enforced runtime spanning verify/deploy gates, promoted data boundaries and invariants, auth (users, sessions, roles, OAuth, email OTP), data/files, server functions with secrets and hooks, realtime/live queries, live room state, payments, AI services, and hosting.",
      "Design the agent-runtime contract so coding agents (Claude Code, Codex, and peers) can build while Bounded enforces declared boundaries on every write: refused cross-boundary mutations, watched/approved routed actions, and deploy gates that keep apps safe to iterate (including lock mode so future edits cannot weaken declared invariants).",
      "Ship the verify/deploy loop agents rely on: policy.json collections, rules, and invariants; bounded verify with concrete counterexamples before deploy; fail-closed server-side proof gates; web and React Native clients via the Bounded SDK (@bounded-sh/client) on bounded.page or custom domains.",
      "Advance OpenApps on that runtime: alliance-backed apps that stay autonomously run and openly governed after their makers step back, with shared hosting, auth, data, payments, and deploy path on Bounded; keep poof.new product lineage clear for the same team.",
      "Cover the managed operator surface in one identity: files/search, Functions and jobs with secrets, realtime subscriptions and server-authoritative live rooms, managed AI/services, direct USDC or provider card payments, action observability, and team governance with roles and approvals.",
      "Carry platform foundations into Bounded: multi-tenant isolation, deployment and edge path (including cold-start work that cut sandbox starts ~60% and supported 5K+ concurrent sessions), agent/MCP test harnesses, and multi-LLM routing by task complexity.",
      "Primary technical voice for architecture, roadmap, and infrastructure cost model across OpenApps, Bounded, and poof.new.",
    ],
  },
  {
    title: "Chief Technology Officer",
    org: "eddii",
    dates: "May 2023 - Aug 2025 (Advisor to Dec 2025)",
    blurb:
      "Seed-stage healthtech building AI-powered diabetes management. Sole technical executive; team of 6.",
    bullets: [
      "Sole C-level technology leader: defined product and tech strategy, architected the full HIPAA-compliant platform from scratch, and delivered to market on time and 20% under budget.",
      "Scaled the platform to 50K+ users in under 12 months, validating product-market fit and forging strategic partnerships with healthcare providers and insurers.",
      "Pioneered the AI/ML strategy, integrating LLMs to deliver personalized health insights via an AI-powered chatbot that drove a 35% increase in daily active usage within 6 months.",
      "Led investor-facing technical demos and narrative that directly contributed to closing $3.5M across multiple venture rounds; managed the full technology P&L and all engineering hiring.",
    ],
  },
  {
    title: "Co-Founder & CTO -> Senior Software Engineer II",
    org: "Dapper Labs (via Acq. of Zay Codes)",
    dates: "Jun 2021 - May 2023",
    blurb:
      "Co-founded blockchain studio; acquired by Dapper Labs; retained to lead technical integration. Team of 15. Overlapped AWS through Mar 2022.",
    bullets: [
      "Co-founded the company, recruited and managed a 15-person engineering team, and secured 5 client contracts to design and ship production dApps on the Flow blockchain.",
      "Won $100K+ in hackathon prizes building open-source developer tools, raising brand visibility across the Flow ecosystem and accelerating acquisition interest from Dapper Labs.",
      "Managed full P&L and led all acquisition negotiations and legal workstreams end-to-end, culminating in a successful acqui-hire by Dapper Labs.",
      "Built the NFT Catalog (adopted as a community-wide standard) and Flow Runner; delivered the API integration used by Instagram to display Flow-based NFTs; mentored engineers as smart-contract SME post-acquisition.",
    ],
  },
  {
    title: "Senior SDE -> Lead, Proactive Security",
    org: "Amazon Web Services",
    dates: "Jan 2015 - Mar 2022",
    blurb:
      "Promoted from Senior SDE to build and lead a new security organization: 4 teams, 30+ engineers; helped scale the broader org from 10 to 100+ engineers across 20+ teams.",
    bullets: [
      "Hand-picked by VP-level leadership to build a new security engineering organization from the ground up: recruited and led 30+ engineers across 4 teams and owned delivery of automation products org-wide.",
      "Shipped a fuzzing and API-model-driven security testing framework covering all 15K+ AWS public APIs, eliminating manual test authoring across service launches.",
      "Injected automated security review into the AWS SDLC (Java, Python), replacing a multi-month manual process and significantly accelerating AWS service launches.",
      "Designed and shipped a web-based SSH client adopted by 15K+ daily users with a 4.4/5 CSAT; led an account management platform handling 50K daily users at 300+ TPS.",
      "Drove development of the SSO/MFA authentication service for 1.5M+ Amazon employees; built an operator authorization service used across AWS safety-critical workflows.",
    ],
  },
] as const;

export const skillGroups = [
  {
    label: "Leadership",
    items:
      "Technical strategy and roadmapping, org building, P&L ownership, M&A technical diligence, investor-facing architecture narrative",
  },
  {
    label: "AI & Agents",
    items:
      "Agent runtimes, MCP / Claude Code / Codex, policy boundaries, evals, multi-model routing, RAG, LLMs (Claude, GPT)",
  },
  {
    label: "Architecture",
    items:
      "Multi-tenant platforms, verify/deploy gates, realtime and live rooms, HIPAA / SOC 2",
  },
  {
    label: "Stack",
    items:
      "TypeScript, React / Node, AWS, Terraform / Docker, Cloudflare Workers",
  },
] as const;

export const education = {
  degree: "M.S., Computer Science & Computer Engineering (Dual Major)",
  school: "Rensselaer Polytechnic Institute",
  notes: "GPA: 3.8 | Dean's List | RPI Medalist",
} as const;

export const publications = [
  {
    title: "Developing Elastic Software for the Cloud",
    text: "S. Imai, P. Patel, C. Varela. Encyclopedia of Cloud Computing, Ch. 50, Wiley-IEEE Press, 2016.",
  },
] as const;
