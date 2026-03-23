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
      <footer className="py-8 border-t border-border">
        <div className="container text-center text-muted-foreground text-xs font-body">
          © {new Date().getFullYear()} Pratik Patel. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Index;
