import { useMemo } from "react";
import { m } from "framer-motion";
import PageShell from "@/components/chrome/PageShell";
import SEO from "@/components/SEO";
import CalEmbed, { CAL_LINK, CAL_URL } from "@/components/CalEmbed";
import { useEntrance } from "@/hooks/useEntrance";
import { mainContentProps } from "@/lib/skip-target";
import { BOOK_TITLE } from "@/lib/route-title";
import { SITE_CARD } from "@/lib/social-cards";
import { personRef } from "@/lib/person-jsonld";

export const BOOK_DESCRIPTION =
  "Book a 30 minute call with Pratik Patel. Agents, architecture, or whatever you are building.";

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

/**
 * /book/: Cal.com's inline embed for a 30 minute call.
 *
 * Cal.com checks Pratik's Google Calendar for conflicts, so this page only
 * hosts the embed. No backend, no key. The embed and its script load from
 * <CalEmbed />, which is the only place the third-party script is requested.
 */
const Book = () => {
  const entrance = useEntrance();

  const jsonLd = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: BOOK_TITLE,
        description: BOOK_DESCRIPTION,
        url: "https://pratik.pa.tel/book/",
        isPartOf: { "@type": "WebSite", name: "Pratik Patel", url: "https://pratik.pa.tel" },
        about: personRef,
        potentialAction: {
          "@type": "ScheduleAction",
          target: CAL_URL,
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://pratik.pa.tel" },
          { "@type": "ListItem", position: 2, name: "Book", item: "https://pratik.pa.tel/book/" },
        ],
      },
    ],
    []
  );

  return (
    <PageShell breadcrumbs={[{ label: "book" }]}>
      <SEO
        title={BOOK_TITLE}
        description={BOOK_DESCRIPTION}
        canonical="https://pratik.pa.tel/book"
        ogImage={SITE_CARD.url}
        ogImageAlt="Pratik Patel - book a call - pratik.pa.tel"
        ogImageWidth={SITE_CARD.width}
        ogImageHeight={SITE_CARD.height}
        jsonLd={jsonLd}
      />
      <main {...mainContentProps} className="pt-28 pb-24">
        <div className="container max-w-4xl">
          <m.header
            initial={entrance({ opacity: 0, y: 20 })}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <span className="font-mono text-xs text-primary/60 tracking-widest block mb-3">
              {"// book"}
            </span>
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-3">
              Book time with me
            </h1>
            <p className="font-mono text-sm text-muted-foreground leading-relaxed max-w-2xl">
              30 minutes on agents, architecture, or whatever you are building.
            </p>
          </m.header>

          <m.section
            initial={entrance({ opacity: 0, y: 20 })}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="relative border border-border bg-card pt-8"
            aria-label="Booking calendar"
          >
            <WindowChrome filename="30min.cal" />
            <CalEmbed />
          </m.section>

          <p className="mt-5 font-mono text-xs text-muted-foreground leading-relaxed">
            Calendar not showing up?{" "}
            <a
              href={CAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="cal-fallback-link"
              className="inline-flex items-center min-h-6 text-primary underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Book on cal.com/{CAL_LINK}
            </a>
            . Or email{" "}
            <a
              href="mailto:pratik@pa.tel"
              className="inline-flex items-center min-h-6 text-primary underline underline-offset-2 hover:text-foreground transition-colors"
            >
              pratik@pa.tel
            </a>
            .
          </p>
        </div>
      </main>
    </PageShell>
  );
};

export default Book;
