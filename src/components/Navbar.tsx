import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, X } from "lucide-react";

const links = [
  { label: "about()", href: "#about" },
  { label: "writing()", href: "#writing" },
  { label: "contact()", href: "#contact" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? "bg-background/80 backdrop-blur-xl border-b border-border" : ""
        }`}
      >
        <div className="container flex items-center justify-between h-16">
          <a href="#" className="font-mono text-sm text-primary flex items-center gap-2 glitch-hover">
            <Terminal className="w-4 h-4" />
            <span>pratik.exe</span>
          </a>
          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
          <button
            onClick={() => setOpen(true)}
            className="md:hidden font-mono text-xs text-primary border border-primary/30 px-3 py-1.5 hover:bg-primary/10 transition-colors"
          >
            [menu]
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex items-center justify-center scanline"
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-5 right-6 text-primary hover:text-foreground transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="flex flex-col items-center gap-6">
              {links.map((link, i) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.1, duration: 0.4 }}
                  className="font-display text-4xl font-bold text-foreground hover:text-primary transition-colors"
                >
                  {link.label}
                </motion.a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
