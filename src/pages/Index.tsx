import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import BlogPreview from "@/components/BlogPreview";
import Contact from "@/components/Contact";
import InteractiveTerminal from "@/components/InteractiveTerminal";
import SEO from "@/components/SEO";

const HEADSHOT_URL = "https://pratik.pa.tel/images/headshot.png";

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
        ogImage={HEADSHOT_URL}
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
