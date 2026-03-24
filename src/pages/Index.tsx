import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import BlogPreview from "@/components/BlogPreview";
import Contact from "@/components/Contact";
import InteractiveTerminal from "@/components/InteractiveTerminal";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <About />
      <BlogPreview />
      <Contact />
      <InteractiveTerminal />
      <footer className="py-6 border-t border-border">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[10px] text-muted-foreground tracking-widest">
          <span>© {new Date().getFullYear()} PRATIK PATEL</span>
          <span className="text-primary/40">BUILT WITH PURPOSE // v3.0</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
