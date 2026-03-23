import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import BlogPreview from "@/components/BlogPreview";
import Contact from "@/components/Contact";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <About />
      <BlogPreview />
      <Contact />
      <footer className="py-6 border-t border-border">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-muted-foreground text-xs font-body">
          <span>© {new Date().getFullYear()} Pratik Patel</span>
          <span className="tracking-[0.2em] uppercase">Built with purpose</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
