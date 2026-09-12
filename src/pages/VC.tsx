import { useMemo, useState, type FormEvent } from "react";
import { m } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import PageShell from "@/components/chrome/PageShell";
import SEO from "@/components/SEO";
import { useEntrance } from "@/hooks/useEntrance";
import { mainContentProps } from "@/lib/skip-target";
import { VC_TITLE } from "@/lib/route-title";
import { SITE_CARD } from "@/lib/social-cards";
import { personRef } from "@/lib/person-jsonld";

const VC_DESCRIPTION =
  "Angel investing and advisor lens from Pratik Patel. Builder background across OpenApps, Bounded, and earlier company-building. Pitch via the form on this page.";

// Prefer VITE_FORMSUBMIT_ENDPOINT after first FormSubmit activation: paste their
// random form URL there to hide the raw inbox email in the HTML source.
const FORMSUBMIT_ACTION =
  import.meta.env.VITE_FORMSUBMIT_ENDPOINT ?? "https://formsubmit.co/pratik@pa.tel";
const SUCCESS_NEXT = "https://pratik.pa.tel/vc/?sent=1";
const MESSAGE_MIN_LEN = 20;
const SPAM_BLACKLIST =
  "viagra,cialis,crypto airdrop,airdrop,nft giveaway,free money,casino,lottery,seo backlinks,earn from home";

const WindowChrome = ({ filename }: { filename: string }) => (
  <div className="absolute top-0 left-0 right-0 h-8 bg-muted border-b border-border flex items-center px-4 gap-2">
    <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
    <span className="w-2.5 h-2.5 rounded-full bg-primary/40" />
    <span className="w-2.5 h-2.5 rounded-full bg-primary/60" />
    <span className="font-mono text-[10px] text-muted-foreground ml-3 tracking-widest">
      {filename}
    </span>
  </div>
);

const SectionLabel = ({ children }: { children: string }) => (
  <span className="font-mono text-xs text-primary/60 tracking-widest block mb-3">
    {children}
  </span>
);

const fieldClass =
  "w-full bg-background border border-border px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:box-glow transition-colors";

const labelClass = "font-mono text-[10px] text-muted-foreground tracking-widest block mb-1.5";

const thesis = [
  {
    label: "AI agents",
    body: "Teams turning agents into real product surface: run loops, evals, permissions, and the boring glue that keeps them from failing quietly.",
  },
  {
    label: "Infra for builders",
    body: "Developer tools and platforms that make shipping safer and faster when the unit of work is an agent, not a ticket.",
  },
  {
    label: "Founder-led",
    body: "Early teams where the founders still own the hard technical bets, and advice can compound because the product is still plastic.",
  },
] as const;

const VC = () => {
  const entrance = useEntrance();
  const [searchParams] = useSearchParams();
  const sent = searchParams.get("sent") === "1";
  const [submitting, setSubmitting] = useState(false);

  const jsonLd = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: VC_TITLE,
        description: VC_DESCRIPTION,
        url: "https://pratik.pa.tel/vc/",
        isPartOf: { "@type": "WebSite", name: "Pratik Patel", url: "https://pratik.pa.tel" },
        about: {
          ...personRef,
          jobTitle: "CTO & Chief Architect",
          email: "pratik@pa.tel",
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
            name: "VC",
            item: "https://pratik.pa.tel/vc/",
          },
        ],
      },
    ],
    []
  );

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (submitting) {
      e.preventDefault();
      return;
    }
    const form = e.currentTarget;
    const messageEl = form.elements.namedItem("message") as HTMLTextAreaElement | null;
    if (messageEl) {
      const trimmed = messageEl.value.trim();
      if (trimmed.length > 0 && trimmed.length < MESSAGE_MIN_LEN) {
        messageEl.setCustomValidity(
          `If you include a message, use at least ${MESSAGE_MIN_LEN} characters.`
        );
        messageEl.reportValidity();
        e.preventDefault();
        return;
      }
      messageEl.setCustomValidity("");
    }
    // Native FormSubmit POST; flag UI so a slow redirect does not look stuck.
    setSubmitting(true);
  };

  return (
    <PageShell breadcrumbs={[{ label: "vc" }]}>
      <SEO
        title={VC_TITLE}
        description={VC_DESCRIPTION}
        canonical="https://pratik.pa.tel/vc"
        ogImage={SITE_CARD.url}
        ogImageAlt="Pratik Patel - angel investing - pratik.pa.tel"
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
            className="mb-10"
          >
            <SectionLabel>{"// vc"}</SectionLabel>
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-3">
              Angel investing
            </h1>
            <p className="font-mono text-sm text-primary mb-4 leading-relaxed">
              Advisor and angel lens from a builder seat
            </p>
            <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl">
              I invest and advise selectively as an operator who has built, raised,
              shipped, and sold. This page is for founders who want a direct pitch,
              not a manufactured portfolio wall.
            </p>
          </m.header>

          <m.section
            initial={entrance({ opacity: 0, y: 20 })}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="relative border border-border bg-card mb-8 pt-10 pb-6 px-5 sm:px-6"
            aria-labelledby="vc-lens-heading"
          >
            <WindowChrome filename="lens.md" />
            <SectionLabel>{"// how I look at deals"}</SectionLabel>
            <h2 id="vc-lens-heading" className="font-display text-2xl font-bold text-foreground mb-3">
              Operator first
            </h2>
            <ul className="space-y-3 font-mono text-sm text-muted-foreground leading-relaxed">
              <li className="border-l-2 border-primary/40 pl-3">
                Prefer founders who can explain the product, the loop, and the risk
                without a slide that does the talking.
              </li>
              <li className="border-l-2 border-primary/40 pl-3">
                Helpful on architecture, agent product surface, hiring, and the
                ugly middle between demo and durable system.
              </li>
              <li className="border-l-2 border-primary/40 pl-3">
                No invented check sizes, logos, or deal list here. If we talk, we
                talk about your company as it is.
              </li>
            </ul>
          </m.section>

          <m.section
            initial={entrance({ opacity: 0, y: 20 })}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mb-10"
            aria-labelledby="vc-thesis-heading"
          >
            <SectionLabel>{"// thesis (general)"}</SectionLabel>
            <h2 id="vc-thesis-heading" className="font-display text-2xl font-bold text-foreground mb-2">
              Areas I am watching
            </h2>
            <p className="font-mono text-xs text-muted-foreground mb-5 leading-relaxed max-w-2xl">
              Speculative framing, not a closed fund mandate. Useful as a signal of
              what I will read carefully.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {thesis.map((item) => (
                <article
                  key={item.label}
                  className="border border-border bg-card p-4 hover:border-primary/40 transition-colors"
                >
                  <h3 className="font-mono text-xs text-primary tracking-widest mb-2">
                    {item.label}
                  </h3>
                  <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
          </m.section>

          <m.section
            id="pitch"
            initial={entrance({ opacity: 0, y: 20 })}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="relative border border-border bg-card pt-10 pb-6 px-5 sm:px-6"
            aria-labelledby="vc-pitch-heading"
          >
            <WindowChrome filename="pitch.form" />
            <SectionLabel>{"// pitch"}</SectionLabel>
            <h2 id="vc-pitch-heading" className="font-display text-2xl font-bold text-foreground mb-2">
              Send a pitch
            </h2>
            <p className="font-mono text-xs text-muted-foreground mb-6 leading-relaxed max-w-2xl">
              Submits by email to{" "}
              <a
                href="mailto:pratik@pa.tel"
                className="inline-flex items-center min-h-6 text-primary underline underline-offset-2 hover:text-foreground transition-colors"
              >
                pratik@pa.tel
              </a>{" "}
              via FormSubmit (static-site friendly for GitHub Pages), with
              reCAPTCHA and a honeypot. First live submit may require a one-time
              FormSubmit confirmation on that inbox.
            </p>

            {sent ? (
              <div
                role="status"
                className="border border-primary/40 bg-primary/5 p-5 mb-2"
              >
                <p className="font-mono text-sm text-primary mb-2 tracking-widest">
                  {"// sent"}
                </p>
                <p className="font-mono text-sm text-foreground leading-relaxed">
                  Thanks. Your pitch is in the inbox. I read these personally and
                  will reply if there is a fit.
                </p>
                <a
                  href="/vc/"
                  className="inline-flex items-center min-h-6 mt-4 font-mono text-xs text-muted-foreground underline underline-offset-2 hover:text-primary transition-colors"
                >
                  send another
                </a>
              </div>
            ) : (
              <form
                action={FORMSUBMIT_ACTION}
                method="POST"
                onSubmit={onSubmit}
                className="space-y-4"
              >
                <input type="hidden" name="_subject" value="Pitch via pratik.pa.tel/vc/" />
                <input type="hidden" name="_next" value={SUCCESS_NEXT} />
                <input type="hidden" name="_template" value="table" />
                <input type="hidden" name="_captcha" value="true" />
                <input type="hidden" name="_blacklist" value={SPAM_BLACKLIST} />
                {/* Honeypot: leave empty. FormSubmit drops submissions that fill it.
                    Off-screen via CSS (not display:none alone) so scrapers still fill it. */}
                <input
                  type="text"
                  name="_honey"
                  className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden opacity-0"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="vc-name" className={labelClass}>
                      name *
                    </label>
                    <input
                      id="vc-name"
                      name="name"
                      required
                      autoComplete="name"
                      className={fieldClass}
                      placeholder="Ada Lovelace"
                    />
                  </div>
                  <div>
                    <label htmlFor="vc-email" className={labelClass}>
                      email *
                    </label>
                    <input
                      id="vc-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      className={fieldClass}
                      placeholder="ada@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="vc-company" className={labelClass}>
                    company / url *
                  </label>
                  <input
                    id="vc-company"
                    name="company"
                    required
                    className={fieldClass}
                    placeholder="Acme (https://acme.example)"
                  />
                </div>

                <div>
                  <label htmlFor="vc-oneliner" className={labelClass}>
                    one-liner *
                  </label>
                  <input
                    id="vc-oneliner"
                    name="one_liner"
                    required
                    maxLength={160}
                    className={fieldClass}
                    placeholder="What you do in one sentence"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="vc-raise" className={labelClass}>
                      raise / stage
                    </label>
                    <input
                      id="vc-raise"
                      name="raise_stage"
                      className={fieldClass}
                      placeholder="Pre-seed · raising $X"
                    />
                  </div>
                  <div>
                    <label htmlFor="vc-deck" className={labelClass}>
                      deck url or note
                    </label>
                    <input
                      id="vc-deck"
                      name="deck"
                      className={fieldClass}
                      placeholder="https://... or 'happy to send'"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="vc-message" className={labelClass}>
                    message
                  </label>
                  <textarea
                    id="vc-message"
                    name="message"
                    rows={5}
                    className={`${fieldClass} resize-y min-h-[7rem]`}
                    placeholder="Why now, what you want from an angel/advisor, anything else useful"
                    onInput={(ev) => {
                      (ev.currentTarget as HTMLTextAreaElement).setCustomValidity("");
                    }}
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center min-h-10 px-5 font-mono text-xs tracking-widest border border-primary/50 text-primary hover:bg-primary/10 hover:box-glow transition-all disabled:opacity-60"
                  >
                    {submitting ? "sending..." : "submit_pitch()"}
                  </button>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    No spam list. Direct email only.
                  </span>
                </div>
              </form>
            )}
          </m.section>
        </div>
      </main>
    </PageShell>
  );
};

export default VC;
