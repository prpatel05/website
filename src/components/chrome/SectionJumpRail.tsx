import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useActiveHeading } from "@/hooks/useActiveHeading";
import { scrollBehavior } from "@/lib/scroll-behavior";
import { chromeAccent, chromeSep } from "./chrome-tokens";

const SECTIONS = [
  { id: "about", label: "about" },
  { id: "writing", label: "writes" },
  { id: "contact", label: "contact" },
] as const;

/**
 * Sticky mono jump list for the homepage one-pager. Revealed once `#about` has
 * crossed mid-viewport — not on a raw scrollY threshold — so short viewports
 * and the hero CTAs stay clear of a second fixed strip while the reader is
 * still in the hero. Highlights the section in view; reduced-motion safe.
 */
const SectionJumpRail = () => {
  const ids = useMemo(() => SECTIONS.map((s) => s.id), []);
  const activeId = useActiveHeading(ids);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const about = document.getElementById("about");
      if (!about) {
        setVisible(false);
        return;
      }
      setVisible(about.getBoundingClientRect().top <= 64);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const onJump = useCallback((event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    event.preventDefault();
    el.scrollIntoView({ behavior: scrollBehavior() });
    history.replaceState(null, "", `#${id}`);
  }, []);

  if (!visible) return null;

  return (
    <nav
      aria-label="On this page"
      className="fixed top-16 left-0 right-0 z-40 border-b border-border bg-background/90 backdrop-blur-md print:hidden"
    >
      <div className="container h-9 flex items-center overflow-x-auto">
        <p className="font-mono text-xs tracking-widest text-muted-foreground whitespace-nowrap">
          <span className="text-primary/60 print:text-primary">{"// "}</span>
          {SECTIONS.map((section, i) => {
            const current = section.id === activeId;
            return (
              <span key={section.id}>
                {i > 0 ? (
                  <span aria-hidden="true" className={`${chromeSep} px-1.5`}>
                    ·
                  </span>
                ) : null}
                <a
                  href={`#${section.id}`}
                  aria-current={current ? "location" : undefined}
                  onClick={(e) => onJump(e, section.id)}
                  className={
                    "inline-flex items-center justify-center min-h-6 min-w-6 px-1.5 transition-colors " +
                    (current
                      ? `${chromeAccent} underline decoration-primary/50 underline-offset-4`
                      : "text-muted-foreground hover:text-primary")
                  }
                >
                  {section.label}
                </a>
              </span>
            );
          })}
        </p>
      </div>
    </nav>
  );
};

export default SectionJumpRail;
