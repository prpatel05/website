import { useState, useEffect, useRef } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Terminal, X } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useOverlayEntrance } from "@/hooks/useEntrance";

const links = [
  { label: "about()", href: "#about" },
  { label: "writing()", href: "#writing" },
  { label: "contact()", href: "#contact" },
  { label: "resume()", href: `${import.meta.env.BASE_URL}resume.pdf`, external: true },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const overlayEntrance = useOverlayEntrance();

  // Naming the toggle is not redundant with the trap remembering where focus
  // came from. Safari and Firefox do not focus a `<button>` on click, so there
  // the menu opens from `<body>` every single time and there is nothing to
  // remember — without this, closing drops the keyboard on every tap-to-open.
  useFocusTrap(dialogRef, open, { fallbackFocus: toggleRef });

  // `[menu]` is `md:hidden`, so crossing the breakpoint with the menu open —
  // rotating a tablet, unfolding a foldable, dragging a desktop window wider —
  // leaves a full-screen modal covering a desktop nav that is perfectly usable
  // behind it, with its own opener gone. Close on the crossing instead.
  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    if (desktop.matches) {
      setOpen(false);
      return;
    }
    const onChange = (e: MediaQueryListEvent) => e.matches && setOpen(false);
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, [open]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // The overlay covers the whole viewport, so without this the icon-only close
  // button is the only way out. Matches the terminal's Escape handling.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      <nav
        aria-label="Main"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? "bg-background/80 backdrop-blur-xl border-b border-border" : ""
        }`}
      >
        <div className="container flex items-center justify-between h-16">
          <a href="#" className="font-mono text-sm text-primary flex items-center gap-2 py-1 glitch-hover">
            <Terminal className="w-4 h-4" />
            <span>pratik.pa.tel</span>
          </a>
          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="font-mono text-xs text-muted-foreground hover:text-primary py-1 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
          <button
            ref={toggleRef}
            onClick={() => setOpen(true)}
            aria-expanded={open}
            className="md:hidden font-mono text-xs text-primary border border-primary/30 px-3 py-1.5 hover:bg-primary/10 transition-colors"
          >
            [menu]
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <m.div
            ref={dialogRef}
            /*
              Gated on the animation features being here. Ungated, a [menu] tap
              made before that chunk lands mounted this full-screen layer at
              `opacity: 0` with nothing loaded to clear it — invisible, and
              swallowing every tap on the page behind it.
            */
            initial={overlayEntrance({ opacity: 0 })}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            // Only a click that lands on the overlay itself dismisses; clicks
            // that bubble up from the links or the close button are theirs.
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
            // `md:hidden` covers the 300ms the close above still has to fade
            // through: the overlay is `z-[100]` over a `z-50` nav, so without it
            // a resize past the breakpoint paints a modal over the desktop menu
            // for a third of a second on the way out.
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex md:hidden items-center justify-center scanline"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-5 right-6 text-primary hover:text-foreground transition-colors"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </button>
            <div className="flex flex-col items-center gap-6">
              {links.map((link, i) => (
                <m.a
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  initial={overlayEntrance({ opacity: 0, x: -30 })}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.1, duration: 0.4 }}
                  className="font-display text-4xl font-bold text-foreground hover:text-primary transition-colors"
                >
                  {link.label}
                </m.a>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
