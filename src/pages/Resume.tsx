import { m } from "framer-motion";
import PageShell from "@/components/chrome/PageShell";
import SEO from "@/components/SEO";
import { useEntrance } from "@/hooks/useEntrance";
import { mainContentProps } from "@/lib/skip-target";
import { RESUME_TITLE } from "@/lib/route-title";
import { SITE_CARD } from "@/lib/social-cards";
import { personRef } from "@/lib/person-jsonld";
import {
  education,
  executiveSummary,
  experience,
  publications,
  resumeMeta,
  skillGroups,
} from "@/data/resume";

const RESUME_DESCRIPTION =
  "HTML resume for Pratik Patel - Chief Architect at OpenApps | Bounded | poof.new. Career across agent platforms, eddii, Dapper Labs, and AWS. Download the PDF anytime.";

const resumePdfHref = `${import.meta.env.BASE_URL}resume.pdf`;

const WindowChrome = ({ filename }: { filename: string }) => (
  <div className="absolute top-0 left-0 right-0 h-8 bg-muted border-b border-border flex items-center px-4 gap-2 print:hidden">
    <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
    <span className="w-2.5 h-2.5 rounded-full bg-primary/40" />
    <span className="w-2.5 h-2.5 rounded-full bg-primary/60" />
    <span className="font-mono text-[10px] text-muted-foreground ml-3 tracking-widest">
      {filename}
    </span>
  </div>
);

const SectionLabel = ({ children }: { children: string }) => (
  <span className="font-mono text-xs text-primary/60 tracking-widest block mb-3 print:hidden">
    {children}
  </span>
);

const Resume = () => {
  const entrance = useEntrance();

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      name: RESUME_TITLE,
      description: RESUME_DESCRIPTION,
      url: "https://pratik.pa.tel/resume/",
      mainEntity: {
        ...personRef,
        jobTitle: "Chief Architect",
        email: resumeMeta.email,
        telephone: resumeMeta.phone,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://pratik.pa.tel",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Resume",
          item: "https://pratik.pa.tel/resume/",
        },
      ],
    },
  ];

  return (
    <PageShell breadcrumbs={[{ label: "resume" }]}>
      <SEO
        title={RESUME_TITLE}
        description={RESUME_DESCRIPTION}
        canonical="https://pratik.pa.tel/resume"
        ogImage={SITE_CARD.url}
        ogImageAlt="Pratik Patel - Chief Architect - pratik.pa.tel"
        ogImageWidth={SITE_CARD.width}
        ogImageHeight={SITE_CARD.height}
        jsonLd={jsonLd}
      />
      <main {...mainContentProps} className="pt-28 pb-24">
        <div className="container max-w-3xl">
          <m.header
            initial={entrance({ opacity: 0, y: 20 })}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-10 resume-block"
          >
            <SectionLabel>{"// resume.html"}</SectionLabel>
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-2">
              {resumeMeta.name}
            </h1>
            <p className="font-mono text-sm text-primary mb-4 leading-relaxed">
              {resumeMeta.headline}
            </p>
            <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-2">
              {resumeMeta.location}
              {" | "}
              <a
                href={resumeMeta.emailHref}
                className="inline-flex items-center min-h-6 hover:text-primary transition-colors underline-offset-2 hover:underline"
              >
                {resumeMeta.email}
              </a>
              {" | "}
              <a
                href={resumeMeta.phoneHref}
                className="inline-flex items-center min-h-6 hover:text-primary transition-colors underline-offset-2 hover:underline"
              >
                {resumeMeta.phone}
              </a>
            </p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] tracking-widest text-muted-foreground mb-6">
              {resumeMeta.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center min-h-6 min-w-6 px-1.5 hover:text-primary transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <a
              href={resumePdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex font-mono text-xs border border-primary/30 print:hidden text-primary px-4 py-2 hover:bg-primary/10 transition-colors min-h-11 items-center"
            >
              download resume.pdf
            </a>
          </m.header>

          <section className="mb-10 resume-block" aria-labelledby="resume-summary">
            <div className="border border-border bg-card p-6 lg:p-8 relative">
              <WindowChrome filename="summary.md" />
              <div className="mt-8 print:mt-0 space-y-3">
                <h2
                  id="resume-summary"
                  className="font-display text-xl font-bold text-foreground"
                >
                  Executive <span className="text-accent text-glow-accent">summary</span>
                </h2>
                {executiveSummary.map((para) => (
                  <p
                    key={para.slice(0, 40)}
                    className="font-mono text-sm text-muted-foreground leading-relaxed"
                  >
                    {para}
                  </p>
                ))}
              </div>
            </div>
          </section>

          <section className="mb-10" aria-labelledby="resume-experience">
            <SectionLabel>{"// professional_experience"}</SectionLabel>
            <h2
              id="resume-experience"
              className="font-display text-2xl font-bold mb-6 text-foreground"
            >
              Experience
            </h2>
            <ol className="space-y-6">
              {experience.map((role) => (
                <li
                  key={`${role.org}-${role.dates}`}
                  className="border border-border bg-card p-6 relative resume-block"
                >
                  <WindowChrome filename={`${role.org.split(" ")[0].toLowerCase()}.role`} />
                  <div className="mt-8 print:mt-0">
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-1">
                      <h3 className="font-display text-lg font-bold text-foreground">
                        {role.title}
                      </h3>
                      <span className="font-mono text-[10px] text-primary/80 print:text-primary tracking-widest shrink-0">
                        {role.dates}
                      </span>
                    </div>
                    <p className="font-mono text-sm text-primary mb-1">{role.org}</p>
                    {role.orgLinks && role.orgLinks.length > 0 ? (
                      <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] tracking-widest text-muted-foreground mb-2">
                        {role.orgLinks.map((link) => (
                          <li key={link.href}>
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center min-h-6 hover:text-primary transition-colors underline-offset-2 hover:underline"
                            >
                              {link.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="font-mono text-xs text-muted-foreground mb-4 leading-relaxed">
                      {role.blurb}
                    </p>
                    <ul className="space-y-2">
                      {role.bullets.map((bullet) => (
                        <li
                          key={bullet.slice(0, 48)}
                          className="font-mono text-sm text-muted-foreground leading-relaxed pl-4 relative before:content-['>'] before:absolute before:left-0 before:text-primary/60 print:before:text-primary"
                        >
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="mb-10 resume-block" aria-labelledby="resume-skills">
            <div className="border border-border bg-card p-6 lg:p-8 relative">
              <WindowChrome filename="skills.config" />
              <div className="mt-8 print:mt-0">
                <h2
                  id="resume-skills"
                  className="font-display text-xl font-bold text-foreground mb-4"
                >
                  Technical <span className="text-accent text-glow-accent">skills</span>
                </h2>
                <dl className="space-y-3">
                  {skillGroups.map((group) => (
                    <div key={group.label} className="resume-avoid-break">
                      <dt className="font-mono text-[10px] text-primary tracking-widest mb-1">
                        {group.label}
                      </dt>
                      <dd className="font-mono text-sm text-muted-foreground leading-relaxed">
                        {group.items}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </section>

          <section className="mb-10 resume-block" aria-labelledby="resume-education">
            <SectionLabel>{"// education"}</SectionLabel>
            <h2
              id="resume-education"
              className="font-display text-2xl font-bold mb-4 text-foreground"
            >
              Education
            </h2>
            <div className="border border-border bg-card p-5">
              <h3 className="font-mono text-sm text-foreground mb-1">{education.degree}</h3>
              <p className="font-mono text-sm text-primary mb-1">{education.school}</p>
              <p className="font-mono text-xs text-muted-foreground">{education.notes}</p>
            </div>
          </section>

          <section className="resume-block" aria-labelledby="resume-publications">
            <SectionLabel>{"// publications"}</SectionLabel>
            <h2
              id="resume-publications"
              className="font-display text-2xl font-bold mb-4 text-foreground"
            >
              Publications
            </h2>
            <ul className="space-y-3">
              {publications.map((pub) => (
                <li
                  key={pub.title}
                  className="border border-border bg-card p-4 resume-avoid-break"
                >
                  <h3 className="font-mono text-xs text-primary tracking-widest mb-1">
                    {pub.title}
                  </h3>
                  <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                    {pub.text}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </PageShell>
  );
};

export default Resume;
