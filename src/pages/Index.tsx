import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import BlogPreview from "@/components/BlogPreview";
import Contact from "@/components/Contact";
import InteractiveTerminal from "@/components/InteractiveTerminal";
import SEO from "@/components/SEO";

// The portrait, used for the Person JSON-LD where a headshot is what's wanted.
const HEADSHOT_URL = "https://pratik.pa.tel/images/headshot.png";

// The share card. Distinct from the headshot: og:image is consumed as a
// 1.91:1 banner, and the 556x556 portrait fell under the 1200x630 that
// LinkedIn and Facebook require to render the large card instead of a
// small thumbnail. Regenerate with `node scripts/generate-social-card.mjs`.
const SOCIAL_CARD_URL = "https://pratik.pa.tel/images/social-card.png";
const SOCIAL_CARD_WIDTH = 1200;
const SOCIAL_CARD_HEIGHT = 630;

const personJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Pratik Patel",
    url: "https://pratik.pa.tel",
  },
  {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Pratik Patel",
    url: "https://pratik.pa.tel",
    image: HEADSHOT_URL,
    jobTitle: "CTO & Chief Architect",
    description:
      "Technology executive and hands-on architect with 11+ years building and scaling engineering organizations. Three-time company builder with a successful acquisition.",
    worksFor: {
      "@type": "Organization",
      name: "Tarobase (poof.new)",
    },
    knowsAbout: [
      "Artificial Intelligence",
      "Cloud Computing",
      "Web3",
      "TypeScript",
      "React",
      "Node.js",
      "AWS",
      "Python",
      "Go",
      "Blockchain",
      "Engineering Leadership",
      "Startup Building",
    ],
    sameAs: [
      "https://www.linkedin.com/in/prpatel05/",
      "https://github.com/prpatel05",
      "https://medium.com/@prpatel05",
      "https://x.com/prpatel05",
      "https://dev.to/prpatel05",
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Washington",
      addressRegion: "DC",
      addressCountry: "US",
    },
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Pratik Patel — CTO & Chief Architect"
        description="Technology executive, CTO, and 3x company builder with 11+ years scaling engineering orgs across AI, Cloud, and Web3. Currently Chief Architect at Tarobase."
        canonical="https://pratik.pa.tel/"
        ogImage={SOCIAL_CARD_URL}
        ogImageAlt="Pratik Patel — CTO & Chief Architect — pratik.pa.tel"
        ogImageWidth={SOCIAL_CARD_WIDTH}
        ogImageHeight={SOCIAL_CARD_HEIGHT}
        jsonLd={personJsonLd}
      />
      <Navbar />
      <Hero />
      <About />
      <BlogPreview />
      <Contact />
      <InteractiveTerminal />
      <footer className="py-6 border-t border-border">
        <div className="container px-4 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 font-mono text-[10px] text-muted-foreground tracking-widest">
          <span>© {new Date().getFullYear()} PRATIK PATEL</span>
          <span className="text-primary/40">BUILT WITH PURPOSE // v3.0</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
