/**
 * Resume content for the HTML `/resume/` page.
 *
 * Sourced from `public/resume.pdf` and the About / Contact copy on the site.
 * Do not invent employers or dates here — keep this aligned with the PDF.
 */

export const resumeMeta = {
  name: "Pratik Patel",
  headline:
    "CTO & Chief Architect | AI · Cloud · Web3 | 3x Company Builder | Startup Co-Founder (Acquired)",
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
  "Technology executive and hands-on architect with 11+ years building and scaling engineering organizations and shipping products to hundreds of thousands of users.",
  "Three-time company builder: grew a 30-person engineering org at AWS, co-founded and sold a blockchain studio via acquisition by Dapper Labs, and took a healthtech startup from napkin sketch to 50K+ users as founding CTO.",
  "Proven ability to set technical strategy, recruit world-class teams, manage multi-million-dollar P&Ls, raise venture capital, and close M&A transactions.",
] as const;

export const careerHighlights = [
  {
    title: "Founding CTO",
    text: "Built a HIPAA-compliant healthtech platform from zero to 50K+ users in under 12 months; owned all technology, budget, hiring, and vendor strategy.",
  },
  {
    title: "Startup Founder & M&A",
    text: "Recruited a 15-person engineering team, generated revenue across 5 client contracts, and orchestrated the full acquisition by Dapper Labs including due diligence, financials, and legal.",
  },
  {
    title: "Enterprise Org Builder",
    text: "Created and led a 30-person engineering organization at AWS spanning 4 teams; shipped security automation used across all AWS service launches.",
  },
  {
    title: "Capital Raiser & Board Operator",
    text: "Raised $3.5M across multiple venture rounds, presented technology vision to investors and board members, and managed technology budgets delivering under plan.",
  },
] as const;

export type ResumeRole = {
  title: string;
  org: string;
  dates: string;
  blurb: string;
  bullets: readonly string[];
};

export const experience: readonly ResumeRole[] = [
  {
    title: "Chief Architect",
    org: "Tarobase (poof.new)",
    dates: "Aug 2025 – Present",
    blurb: "Web3 startup building AI-powered tools for vibe-coded dApps — team of 5",
    bullets: [
      "Define and own the company's full-stack technical architecture and platform strategy, designing multi-tenant isolation with cost-efficient unit economics at scale.",
      "Architected and shipped the deployment pipeline and edge caching layer that reduced sandbox cold-start times by 60%, supporting 5K+ concurrent user sessions.",
      "Established the agentic AI strategy and delivered automated test harnesses for Claude Code agent workflows and MCP integrations, accelerating feature velocity within the first 90 days.",
      "Own the full technical roadmap, infrastructure cost model, and architecture decisions; serve as the primary technical voice to investors and partners.",
      "Designed and shipped a multi-LLM routing layer that intelligently directs requests across model providers based on task complexity, cutting AI infrastructure costs while maintaining output quality.",
    ],
  },
  {
    title: "Chief Technology Officer",
    org: "eddii",
    dates: "May 2023 – Aug 2025 (Advisor to Dec 2025)",
    blurb:
      "Seed-stage healthtech startup — AI-powered diabetes management — sole technical executive — team of 6",
    bullets: [
      "Served as the sole C-level technology leader: defined product and technology strategy, architected the full HIPAA-compliant platform from scratch, and delivered to market on time and 20% under budget.",
      "Scaled the platform to 50K+ users in under 12 months, validating product-market fit and forging strategic partnerships with healthcare providers and insurers.",
      "Pioneered the AI/ML strategy, integrating LLMs to deliver personalized health insights via an AI-powered chatbot that drove a 35% increase in daily active usage within 6 months.",
      "Led investor-facing technical demos and narrative that directly contributed to closing $3.5M across multiple venture rounds; managed the full technology P&L and all engineering hiring.",
    ],
  },
  {
    title: "Co-Founder & CTO -> Senior Software Engineer II",
    org: "Dapper Labs (via Acq. of Zay Codes)",
    dates: "Jun 2021 – May 2023",
    blurb:
      "Co-founded blockchain studio — acquired by Dapper Labs — retained post-acquisition to lead technical integration — team of 15",
    bullets: [
      "Co-founded the company, recruited and managed a 15-person engineering team, and secured 5 client contracts to design and ship production dApps on the Flow blockchain.",
      "Won $100K+ in hackathon prizes building open-source developer tools, raising brand visibility across the Flow ecosystem and accelerating acquisition interest from Dapper Labs.",
      "Managed full P&L and led all acquisition negotiations and legal workstreams end-to-end, culminating in a successful acqui-hire by Dapper Labs.",
      "Built the NFT Catalog (adopted as a community-wide standard) and Flow Runner; delivered the API integration used by Instagram to display Flow-based NFTs.",
    ],
  },
  {
    title: "Senior SDE -> Lead, Proactive Security",
    org: "Amazon Web Services",
    dates: "Jan 2015 – Mar 2022",
    blurb:
      "Promoted from Senior SDE to build and lead a new security organization — 4 teams, 30+ engineers; helped scale the broader org from 10 to 100+ engineers across 20+ teams",
    bullets: [
      "Hand-picked by VP-level leadership to build a new security engineering organization from the ground up: recruited and led 30+ engineers across 4 teams and owned delivery of automation products org-wide.",
      "Shipped a fuzzing and API-model-driven security testing framework covering all 15K+ AWS public APIs, eliminating manual test authoring across service launches.",
      "Injected automated security review into the AWS SDLC, replacing a multi-month manual process and significantly accelerating AWS service launches.",
      "Designed and shipped a web-based SSH client adopted by 15K+ daily users; led an account management platform handling 50K daily users at 300+ TPS.",
      "Drove development of the SSO/MFA authentication service for 1.5M+ Amazon employees; built an operator authorization service used across AWS safety-critical workflows.",
    ],
  },
] as const;

export const skillGroups = [
  {
    label: "Languages",
    items:
      "TypeScript, JavaScript, Java, Python, Go, Ruby, Bash, C/C++, Cadence, Solidity",
  },
  {
    label: "Frameworks & Runtime",
    items: "React, Next.js, Node.js, Bun, Express, Ruby on Rails, Playwright",
  },
  {
    label: "Cloud & Infrastructure",
    items:
      "AWS (EC2, S3, Lambda, DynamoDB, CloudFront, IAM), GCP, Kubernetes, Docker, Terraform, Cloudflare Workers",
  },
  {
    label: "AI & Machine Learning",
    items:
      "LLM Integration (Claude, GPT), Agentic AI (MCP, Claude Code), Deep Learning, ML Pipelines, AI Model Deployment, NLP, Prompt Engineering, RAG",
  },
  {
    label: "Blockchain & Web3",
    items:
      "Flow (Cadence), EVM (Solidity), Smart Contracts, dApp Architecture, NFT Standards, Tokenomics",
  },
  {
    label: "Architecture & Systems",
    items:
      "Distributed Systems at Scale, Microservices, SOA, Event-Driven, API-First Design, High Availability, Data Architecture, Security Engineering, Platform Engineering",
  },
  {
    label: "Governance & Delivery",
    items:
      "Agile/Scrum, DevOps, CI/CD (GitHub Actions), Observability, HIPAA/SOC 2, FinOps, Vendor Management",
  },
  {
    label: "Executive Leadership",
    items:
      "Technology Strategy & Roadmapping, P&L Ownership, Cross-Functional Leadership, Technical Due Diligence & M&A, Talent Acquisition, Stakeholder & Board Communication, Capital Raising",
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
    text: "Open-source TypeScript framework for testing and evaluating AI agent workflows; built internally at Tarobase and released to the community (github.com/poofdotnew/vibe-check).",
  },
  {
    title: "Developing Elastic Software for the Cloud",
    text: "S. Imai, P. Patel, C. Varela — Encyclopedia of Cloud Computing, Ch. 50, Wiley-IEEE Press, 2016.",
  },
] as const;
