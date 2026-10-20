/**
 * Resume content for the HTML `/resume/` page.
 *
 * Keep this aligned with `public/resume.pdf`. Do not invent employers, dates,
 * founder credit, or metrics.
 */

export const resumeMeta = {
  name: "Pratik Patel",
  headline:
    "Engineering & AI Executive | AI Agent Platforms & Security | Built 30+ Engineer Org at AWS | Co-Founder (Acquired)",
  location: "Washington, DC (Open to Remote)",
  citizenship: "U.S. Citizen",
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
  "Engineering and AI executive who builds teams and platforms from zero. At AWS, built and led a new 30+ engineer, 4-team Proactive Security organization, shipped automated security testing across all 15K+ public AWS APIs, drove the SSO/MFA service for 1.5M+ Amazon employees, and helped scale the broader org from 10 to 100+ engineers.",
  "As founding CTO of eddii, took a HIPAA-compliant AI health platform to 50K+ users in under 12 months and helped raise $3.5M while owning the technology P&L and all hiring. Co-founded Zay Codes (acquired by Dapper Labs). Now Chief Architect of Bounded, a policy-enforced runtime that lets AI coding agents ship production apps safely.",
] as const;

export type ResumeOrgLink = {
  label: string;
  href: string;
};

export type ResumeRole = {
  title: string;
  org: string;
  /** One date range only. Notes like advisory periods go in a bullet, not here. */
  dates: string;
  blurb: string;
  bullets: readonly string[];
  orgLinks?: readonly ResumeOrgLink[];
};

export const experience: readonly ResumeRole[] = [
  {
    title: "Chief Architect",
    org: "Bounded",
    dates: "Aug 2025 - Present",
    blurb:
      "AI agent platform. OpenApps runs on Bounded; poof.new is the team's earlier product line.",
    orgLinks: [
      { label: "bounded.sh", href: "https://bounded.sh" },
      { label: "openapps.xyz", href: "https://openapps.xyz" },
      { label: "poof.new", href: "https://poof.new" },
    ],
    bullets: [
      "Architected Bounded, a runtime that lets AI coding agents (Claude Code, Codex) build and deploy full-stack apps safely: each data write is checked against declared boundaries, risky actions need approval, and deploys fail closed.",
      "Cut sandbox cold starts ~60% and scaled multi-tenant isolation to 5K+ concurrent sessions.",
      "Shipped multi-LLM routing across providers by task complexity, cutting AI infrastructure cost while holding quality.",
      "Built test and eval harnesses for Claude Code, Codex, and MCP workflows, speeding delivery in the first 90 days.",
      "Own architecture, roadmap, and infrastructure cost model; primary technical voice with founders and investors.",
    ],
  },
  {
    title: "Chief Technology Officer",
    org: "eddii",
    dates: "May 2023 - Aug 2025",
    blurb:
      "Seed-stage healthtech building AI-powered diabetes management. Sole technical executive; team of 6.",
    bullets: [
      "Set product and tech strategy; architected the HIPAA-compliant platform from scratch; launched on time, 20% under budget.",
      "Scaled to 50K+ users in under 12 months; forged strategic partnerships with healthcare providers and insurers.",
      "Led AI/ML strategy: shipped an LLM-powered diabetes care chatbot that lifted daily active usage 35% in 6 months.",
      "Led investor tech demos that helped close $3.5M over multiple venture rounds; owned the tech P&L and all hiring.",
      "Continued as technical advisor through Dec 2025.",
    ],
  },
  {
    title: "Senior Software Engineer II",
    org: "Dapper Labs",
    dates: "Apr 2022 - May 2023",
    blurb: "Joined through the acquisition of Zay Codes; retained to lead technical integration.",
    bullets: [
      "Led post-acquisition technical integration and mentored engineers as the Flow smart-contract SME.",
      "Delivered the API integration used by Instagram to display Flow-based NFTs.",
    ],
  },
  {
    title: "Co-Founder & CTO",
    org: "Zay Codes",
    dates: "Jun 2021 - Apr 2022",
    blurb:
      "Blockchain engineering studio, acquired by Dapper Labs. Team of 15. Overlapped AWS through Mar 2022.",
    bullets: [
      "Co-founded the company; recruited and led a 15-person engineering team and won 5 client contracts for Flow blockchain dApps.",
      "Owned the P&L and led acquisition negotiations and legal workstreams end-to-end through the sale to Dapper Labs.",
      "Built the NFT Catalog (adopted as a Flow community-wide standard) and Flow Runner.",
      "Won $100K+ in hackathon prizes for open-source developer tools.",
    ],
  },
  {
    title: "Senior SDE -> Lead, Proactive Security",
    org: "Amazon Web Services",
    dates: "Jan 2015 - Mar 2022",
    blurb:
      "Helped scale the broader org from 10 to 100+ engineers across 20+ teams.",
    bullets: [
      "Hand-picked by VP-level leadership to found the Proactive Security engineering organization: recruited and led 30+ engineers across 4 teams and owned security automation products org-wide.",
      "Shipped an automated fuzzing and API-model-driven security testing framework covering all 15K+ public AWS APIs, eliminating manual security test authoring across service launches.",
      "Embedded automated security review into the AWS secure SDLC (Java, Python), replacing a multi-month manual review process and significantly accelerating AWS service launches.",
      "Drove development of the SSO/MFA authentication service protecting 1.5M+ Amazon employees.",
      "Built an operator authorization service (identity and access management) used across AWS safety-critical workflows.",
      "Designed and shipped a web-based SSH client adopted by 15K+ daily users with a 4.4/5 CSAT.",
      "Led an account management platform handling 50K daily users at 300+ TPS.",
    ],
  },
] as const;

export const skillGroups = [
  {
    label: "Leadership",
    items:
      "Technical strategy and roadmapping, org building and hiring, P&L ownership, M&A diligence and integration, fundraising and investor communication",
  },
  {
    label: "Security & Identity",
    items:
      "Identity and access management (SSO, MFA, OAuth, authorization), secure SDLC, fuzzing and automated security testing, HIPAA, SOC 2",
  },
  {
    label: "AI & Agents",
    items:
      "Agent runtimes, agent guardrails and policy boundaries, MCP / Claude Code / Codex, evals, multi-model routing and LLM cost optimization, RAG, LLMs (Claude, GPT)",
  },
  {
    label: "Architecture",
    items:
      "Multi-tenant SaaS, distributed systems, serverless and edge, real-time systems",
  },
  {
    label: "Stack",
    items:
      "TypeScript, React / Node, Java, Python, AWS, Terraform / Docker, Cloudflare Workers",
  },
] as const;

export type ResumeDegree = {
  degree: string;
  school: string;
  dates: string;
  notes?: string;
};

export const education: readonly ResumeDegree[] = [
  {
    degree: "M.S., Computer Science & Computer Engineering",
    school: "Rensselaer Polytechnic Institute",
    dates: "May 2014 - Dec 2014",
    notes: "GPA: 3.8",
  },
  {
    degree: "B.S.",
    school: "Rensselaer Polytechnic Institute",
    dates: "Aug 2010 - May 2014",
  },
] as const;

export const publications = [
  {
    title: "Developing Elastic Software for the Cloud",
    text: "S. Imai, P. Patel, C. Varela. Encyclopedia of Cloud Computing, Ch. 50, Wiley-IEEE Press, 2016.",
  },
] as const;
