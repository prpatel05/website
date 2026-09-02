import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import BlogPreview from "@/components/BlogPreview";
import Contact from "@/components/Contact";
import InteractiveTerminal from "@/components/InteractiveTerminal";
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
    <div className="min-h-screen bg-background">
      <SEO
        title={HOME_TITLE}
        description="Technology executive, CTO, and 3x company builder with 11+ years scaling engineering orgs across AI, Cloud, and Web3. Currently Chief Architect at Tarobase."
        canonical="https://pratik.pa.tel/"
        ogImage={SITE_CARD.url}
        ogImageAlt="Pratik Patel — CTO & Chief Architect — pratik.pa.tel"
        ogImageWidth={SITE_CARD.width}
        ogImageHeight={SITE_CARD.height}
        jsonLd={personJsonLd}
      />
      <Navbar />
      <main {...mainContentProps}>
        <Hero />
        <About />
        <BlogPreview />
        <Contact />
      </main>
      {/* Outside <main>: a floating command palette, not page content. */}
      <InteractiveTerminal />
      <footer className="py-6 border-t border-border">
        <div className="container px-4 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 font-mono text-[10px] text-muted-foreground tracking-widest">
          <span>© {new Date().getFullYear()} PRATIK PATEL</span>
          <span className="text-primary/60 print:text-primary">BUILT WITH PURPOSE // v3.0</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
