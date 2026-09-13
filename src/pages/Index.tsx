import Hero from "@/components/Hero";
import About from "@/components/About";
import BlogPreview from "@/components/BlogPreview";
import Contact from "@/components/Contact";
import PageShell from "@/components/chrome/PageShell";
import SEO from "@/components/SEO";
import { personJsonLd } from "@/lib/person-jsonld";
import { SITE_CARD } from "@/lib/social-cards";
import { mainContentProps } from "@/lib/skip-target";
import { HOME_TITLE } from "@/lib/route-title";

// The share card is SITE_CARD, in @/lib/social-cards — distinct from the
// headshot because og:image is consumed as a 1.91:1 banner, and the 556x556
// portrait fell under the 1200x630 that LinkedIn and Facebook require to
// render the large card instead of a small thumbnail.

const Index = () => {
  return (
    <PageShell jumpRail terminal>
      <SEO
        title={HOME_TITLE}
        description="Technology executive and 3x company builder with 11+ years scaling engineering orgs across AI, Cloud, and Web3. Currently Chief Architect at OpenApps | Bounded | poof.new."
        canonical="https://pratik.pa.tel/"
        ogImage={SITE_CARD.url}
        ogImageAlt="Pratik Patel - Chief Architect - pratik.pa.tel"
        ogImageWidth={SITE_CARD.width}
        ogImageHeight={SITE_CARD.height}
        jsonLd={personJsonLd}
      />
      <main {...mainContentProps}>
        <Hero />
        <About />
        <BlogPreview />
        <Contact />
      </main>
    </PageShell>
  );
};

export default Index;
