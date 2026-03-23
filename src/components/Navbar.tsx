import { ArrowUpRight } from "lucide-react";

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container flex items-center justify-between h-16">
        <span className="font-display font-bold text-lg tracking-tight">
          PRATIK PATEL
        </span>

        <div className="hidden md:flex items-center gap-8">
          <a href="#about" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">
            About
          </a>
          <a href="#blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">
            Blog
          </a>
          <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">
            Contact
          </a>
          <a
            href="mailto:pratik@pa.tel"
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-5 py-2 rounded-full text-sm font-display font-semibold hover:opacity-90 transition-opacity"
          >
            GET IN TOUCH <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
