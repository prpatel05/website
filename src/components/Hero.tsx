import { m, useReducedMotion, useScroll } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { useEntrance, useEntranceGate } from "@/hooks/useEntrance";
import { useFitsViewport, useParallax, useParallaxFade } from "@/hooks/useParallax";
import {
  PORTRAIT_BLANK,
  PORTRAIT_BLANK_MEDIA,
  PORTRAIT_SIZES,
  PORTRAIT_SRC,
  PORTRAIT_SRCSET,
} from "@/lib/portrait";

const roles = [
  "CTO & Chief Architect",
  "AI · Cloud · Web3",
  "3x Company Builder",
  "Startup Co-Founder (Acquired)",
];

const Hero = () => {
  const [roleIndex, setRoleIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const entrance = useEntrance();
  const ctaGate = useEntranceGate();
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  /*
    The whole scroll-linked treatment below presupposes a hero that fits: the
    section is `min-h-screen`, so for as long as its content is shorter than the
    viewport the section is exactly one viewport tall, everything in it is on
    screen at scroll 0, and the fade only ever spends itself on what the reader
    has already been shown.

    Once the content is taller than the viewport that stops being true, and the
    two effects turn on each other. `textY` translates this column down by half
    the scroll it has travelled, so a CTA below the fold closes on it at about
    half a pixel per pixel scrolled, while `fade` still spends its whole range
    over the hero's own height. Measured on `main` at 320 wide, where the column
    is 485px and `./contact --init` sits 407px into it: the CTA's viewport top
    runs `407 - 0.5y` and the fade is done at `y = 388`, leaving it at `top:
    213`. So it needs a viewport of at least 213 + its own 46px to be on screen
    while it is still readable, and below that threshold there is no scroll
    position where a reader can both see it and reach it. At 320x200 and at
    320x256 — the WCAG reflow floor, and a 1280x800 desktop at 400% zoom — it
    scored 2 of 3 (contained, `checkVisibility`, `pointer-events`) at every
    stop from 0 to 700; 320x320 and up scored 3 (PRA-961).

    So a hero that does not fit holds still, which is the regime reduced-motion
    readers are already given: no parallax, no fade, the column simply scrolls
    away with the page. Measured under that regime the same CTA scores 3 of 3
    across a ~140px band of scroll at both heights, and answers
    `elementFromPoint` for itself. Holding the parallax is not incidental to
    holding the fade — the lag is what leaves this column painted over the
    section below it, which is the only reason the fade had to hide it there.
  */
  const holdStill = !useFitsViewport(columnRef);

  const bgY = useParallax(scrollYProgress, [0, 1], ["0%", "30%"], holdStill);
  const textY = useParallax(scrollYProgress, [0, 1], ["0%", "50%"], holdStill);
  const photoY = useParallax(scrollYProgress, [0, 1], ["0%", "-20%"], holdStill);
  // Bound into `style` on the whole hero column, so it is not an animation that
  // `MotionConfig reducedMotion="user"` can switch off — the same reason every
  // sibling here goes through `useParallax`. Left bare, the h1, the role line,
  // both CTAs and the portrait went on fading with the scrollbar for exactly
  // the people who asked them not to.
  //
  // It carries `pointer-events` and `visibility` alongside the opacity so the
  // faded-out column stops taking taps it is far too transparent to be asking
  // for; see `useParallaxFade`. Spread into all three of the styles below —
  // the status rail and the scroll cue are absolutely positioned over the page
  // and would go on covering it just as invisibly.
  const fade = useParallaxFade(scrollYProgress, [0, 0.8], [1, 0], holdStill);
  const scale = useParallax(scrollYProgress, [0, 1], [1, 0.92], holdStill);
  const statusX = useParallax(scrollYProgress, [0, 1], ["0px", "-40px"], holdStill);

  useEffect(() => {
    // A role line that types and retypes itself forever is the longest-running
    // motion on the page. Reduced motion gets the first role, already typed.
    if (reduceMotion) {
      setDisplayText(roles[0]);
      return;
    }

    const currentRole = roles[roleIndex];
    let timeout: NodeJS.Timeout;

    if (!isDeleting && displayText.length < currentRole.length) {
      timeout = setTimeout(() => setDisplayText(currentRole.slice(0, displayText.length + 1)), 80);
    } else if (!isDeleting && displayText.length === currentRole.length) {
      timeout = setTimeout(() => setIsDeleting(true), 2000);
    } else if (isDeleting && displayText.length > 0) {
      timeout = setTimeout(() => setDisplayText(displayText.slice(0, -1)), 40);
    } else if (isDeleting && displayText.length === 0) {
      setIsDeleting(false);
      setRoleIndex((prev) => (prev + 1) % roles.length);
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, roleIndex, reduceMotion]);

  return (
    <section ref={sectionRef} className="relative min-h-screen flex items-center overflow-hidden grid-bg px-4 sm:px-0">
      {/*
        Parallax floating geometric elements.

        Every one of these loops forever, so its inline transform is a frame of
        a running animation: the prerender captured whichever frame the snapshot
        landed on, and the client's first render has none. There is no shared
        value that would make the two agree, and a mismatch React cannot resolve
        is one it would resolve by throwing the prerendered page away. Hence
        `suppressHydrationWarning` on each — framer takes them over a frame
        later regardless of what the attribute said.

        Every alpha below is a contrast budget, not a taste call.

        These drift on infinite loops across a full-bleed `inset-0` layer, and
        the hero's copy is painted straight over them, so any one of them can
        become the backdrop of body text at some frame — which is exactly what
        happened. The `bg-accent` dot passes behind the hero subtitle on a 4s
        loop and dragged it from 6.35:1 to 4.11:1, under the 4.5:1 SC 1.4.3
        floor, for part of every cycle. axe cannot catch this: it reports the
        node `incomplete` ("background could not be determined, element is
        overlapped") and the gate only reads `violations`. Nor is it stable
        enough to catch by eye — the same node measures clean on the other half
        of the loop.

        Position cannot be the fix. At 393px the copy spans the full width, so
        there is nowhere on the layer a particle can drift that is reliably not
        behind text. Brightness is the only lever that holds at every viewport,
        so each alpha is set so that compositing that particle over
        `--background` leaves a surface `--muted-foreground` — the dimmest text
        on the page, and the subtitle's own colour — still clears 4.5:1 on.

        `--primary` needs a much lower alpha than `--accent` for the same
        budget, and that asymmetry is the point rather than an inconsistency:
        `hsl(160 100% 50%)` is `rgb(0 255 170)` at luminance 0.744, near the top
        of the sRGB range. At the 0.6 it used to carry it composites to a
        surface that renders muted-foreground text at 1.32:1 — illegible, not
        merely sub-AA — and it stayed green only because it happened not to
        cross any glyph at the two widths anything measured.

        `text-contrast.test.ts` is what holds this. It has to be the arithmetic
        rather than the screenshot sweep that found it: whether a particle is
        behind a glyph depends on the frame and the width, so a pixel gate
        samples one of each and goes green on the other half of the loop.
      */}
      <m.div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ y: bgY }}>
        <m.div
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute -top-32 -right-32 w-96 h-96 border border-primary/10 rounded-full"
          suppressHydrationWarning
        />
        <m.div
          animate={{ rotate: -360 }}
          transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-20 -left-20 w-72 h-72 border border-accent/10 rounded-full"
          suppressHydrationWarning
        />
        <m.div
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 right-1/4 w-2 h-2 bg-primary rounded-full opacity-[0.15]"
          suppressHydrationWarning
        />
        <m.div
          animate={{ y: [0, 15, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-2/3 left-1/3 w-1.5 h-1.5 bg-accent rounded-full opacity-25"
          suppressHydrationWarning
        />
        <m.div
          animate={{ x: [0, 10, 0], y: [0, -10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 left-1/4 w-1 h-1 bg-primary/15 rounded-full"
          suppressHydrationWarning
        />
        <m.div
          animate={{ x: [0, -8, 0], y: [0, 12, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 right-1/3 w-1 h-8 bg-gradient-to-b from-primary/15 to-transparent"
          suppressHydrationWarning
        />
      </m.div>

      {/*
        Terminal-like status bar with parallax.

        The entrance is a level in from the fade, and has to be: `fade` hands
        the same `opacity` MotionValue to all three elements here, and an
        `initial` naming `opacity` on an element that also binds it does not
        animate that element — framer writes the initial straight into the
        shared value when the element mounts, which zeroes the fade for the
        hero column too. Nested, the two opacities land on two elements and the
        browser composites them, which is the intended reading anyway: the
        entrance plays, and the scroll fade takes the result away. See
        `useParallaxFade` (PRA-979).

        Revealed at `2xl`, not `lg`. This is a gutter ornament: it is pinned to
        the section at `left-8`, so it only has somewhere to live once the
        centred column has left a gutter wide enough to hold it. The column
        starts at `(100vw - 1200px) / 2 + 2rem` and this block ends at 130px,
        so the gutter clears it only past ~1396px — but `lg` revealed it at
        1024px, where there is no gutter at all and the block sits directly on
        top of the hero copy. It read as a collision rather than as clipping
        because `top-24` pins it to the top of the section while the column is
        centred in `min-h-screen`: a shorter viewport raises the column into
        it, so 1280x720 and 1366x768 painted "WASHINGTON, DC" straight through
        "initializing portfolio..." and the name. Height is why the obvious
        width-only check missed this. At `2xl` the gutter is 168px against a
        98px block, so the two are separated horizontally at every height.
      */}
      <m.div
        style={{ x: statusX, ...fade }}
        className="absolute top-24 left-8 hidden 2xl:block font-mono text-[10px] text-muted-foreground"
      >
        <m.div
          initial={entrance({ opacity: 0, x: -20 })}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <span>SYSTEM ONLINE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-accent rounded-full" />
            <span>WASHINGTON, DC</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-primary/50 rounded-full" />
            <span>11+ YRS EXP</span>
          </div>
        </m.div>
      </m.div>

      {/*
        `columnRef` measures this box, not the section: `min-h-screen` clamps
        the section up to the viewport, so its height cannot answer whether the
        content inside it fits. This box is the content.
      */}
      <m.div ref={columnRef} className="container relative z-10" style={{ y: textY, scale, ...fade }}>
        <div className="max-w-4xl">
          <m.div
            initial={entrance({ opacity: 0 })}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="font-mono text-xs text-primary/60 print:text-primary mb-6 tracking-widest"
          >
            {'>'} initializing portfolio...
          </m.div>

          <m.h1
            initial={entrance({ opacity: 0, y: 40 })}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-5xl sm:text-7xl lg:text-9xl font-bold leading-[0.9] tracking-tighter"
          >
            <span className="text-foreground">Pratik</span>
            <br />
            <span className="text-primary text-glow">Patel</span>
          </m.h1>

          <m.div
            initial={entrance({ opacity: 0 })}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-6 sm:mt-8 font-mono text-base sm:text-xl text-muted-foreground"
          >
            {/*
              Both glyphs on this line are `aria-hidden`: they are shell
              decoration, and a screen reader announced the site's most
              prominent line as "dollar sign, CTO & Chief Architect, left five
              eighths block". The convention is already the repo's own —
              InteractiveTerminal.tsx hides the identical `$` prompt, and the
              `|` separators on the archive, the preview and the post page are
              all hidden the same way. The hero was the one place it was missed.
            */}
            <span aria-hidden="true" className="text-primary/60 print:text-primary">$ </span>
            {/*
              A frame of a running animation, so the prerender captured this
              line part-typed and the client's first render starts it empty
              again. That is a text mismatch React treats as fatal: it throws
              and re-renders the whole root, which is precisely the discarded
              prerender this page is trying to keep. `suppressHydrationWarning`
              is the documented escape for content that is legitimately
              client-owned — the typing effect resumes on its own a frame later.
            */}
            <span className="text-foreground/80" suppressHydrationWarning>
              {displayText}
            </span>
            <span aria-hidden="true" className="text-primary cursor-blink ml-0.5">
              ▊
            </span>
          </m.div>

          <m.p
            initial={entrance({ opacity: 0, y: 20 })}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mt-6 sm:mt-8 font-mono text-xs sm:text-sm text-muted-foreground max-w-lg leading-relaxed"
          >
            Technology executive and hands-on architect with 11+ years building
            and scaling engineering organizations. Three-time company builder
            with a successful acquisition under the belt.
          </m.p>

          {/*
            The CTAs come in last, on a 1s delay, so on a client-side arrival
            they spend 1.6s painted at opacity 0 — and measured on `main` they
            were the topmost paint over all 44px and 46px of themselves for
            every frame of it. A tap on the blank space a reader lands on
            jumped the page to #contact or opened the resume in a new tab.
            Same defect as the faded-out column below, one animation earlier;
            `useEntranceGate` is the `useParallaxFade` of an entrance.
          */}
          <m.div
            {...ctaGate}
            initial={entrance({ opacity: 0, y: 20 })}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.6 }}
            className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4"
          >
            <a
              href="#contact"
              // This button is drawn entirely with `background-color` (plus `box-glow`).
              // Forced colours flatten the background to Canvas and drop box-shadow, so
              // with no border it renders as bare link text — less button-like than the
              // bordered secondary CTA beside it. See PRA-998.
              //
              // Print is the same shape of failure with a different cause: the
              // default Save as PDF drops backgrounds, so the fill goes and the
              // button prints as bare text — and, before the `@media print`
              // block flipped `--primary-foreground` to ink, as *white* bare
              // text at 1.00:1, i.e. a blank rectangle. `print:bg-transparent`
              // makes the two print modes agree rather than trading a blank
              // button for dark-on-dark when a reader ticks "Background
              // graphics"; the border is the answer PRA-998 already reached for
              // the same missing fill (PRA-1063).
              className="font-mono text-sm bg-primary text-primary-foreground px-6 py-3 hover:bg-primary/90 transition-colors box-glow text-center forced-colors:border forced-colors:border-[ButtonText] print:bg-transparent print:border print:border-primary"
            >
              ./contact --init
            </a>
            <a
              href={`${import.meta.env.BASE_URL}resume.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              // The sibling above got `print:border-primary` when its fill
              // dropped on paper; this one has never had a fill, so the border
              // has always been the whole button — and at `border-primary/30`
              // composited onto white that boundary printed at 1.63:1, below
              // the 3:1 WCAG 1.4.11 asks of anything identifying a control.
              // Same alpha-toward-paper bug, one button over (PRA-1073).
              className="font-mono text-sm border border-primary/30 print:border-primary text-primary px-6 py-3 hover:bg-primary/10 transition-colors text-center"
            >
              cat resume.pdf
            </a>
          </m.div>
        </div>

        {/* Photo with parallax */}
        <m.div
          initial={entrance({ opacity: 0, scale: 0.8, rotate: 5 })}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: 0.6, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{ y: photoY }}
          className="absolute bottom-0 right-0 lg:right-12 hidden md:block"
        >
          <div className="relative">
            <div className="w-56 h-56 lg:w-72 lg:h-72 overflow-hidden border border-primary/20 box-glow">
              {/*
                The master is a 341KB PNG for a box that is never wider than
                288px, and this wrapper is `hidden md:block` — `display:none`
                does not cancel the fetch, so a phone paid for all of it and
                painted none of it. The build emits a WebP per width instead,
                and the first `<source>` gives the range with no box a blank
                inline pixel so it asks for nothing; see src/lib/portrait.ts for
                why that rather than `loading="lazy"`.

                The `<img>` keeps the real src/srcSet, so it stays the eager,
                preload-scanner-visible candidate everywhere the portrait is
                actually on screen — at 768px it is the LCP element.
              */}
              <picture>
                <source media={PORTRAIT_BLANK_MEDIA} srcSet={PORTRAIT_BLANK} />
                <img
                  src={PORTRAIT_SRC}
                  srcSet={PORTRAIT_SRCSET}
                  sizes={PORTRAIT_SIZES}
                  alt="Pratik Patel"
                  width={288}
                  height={288}
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                />
              </picture>
            </div>
            <div className="absolute -bottom-3 -right-3 font-mono text-[10px] text-primary/60 print:text-primary border border-primary/10 px-2 py-1 bg-background">
              v3.0.1
            </div>
          </div>
        </m.div>
      </m.div>

      {/* Scroll indicator. Entrance nested inside the fade — see the status bar. */}
      <m.div
        style={{ ...fade }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <m.div
          initial={entrance({ opacity: 0 })}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="flex flex-col items-center gap-2"
        >
          <span className="font-mono text-[10px] text-muted-foreground tracking-widest">SCROLL</span>
          {/* Another endless loop — see the note on the drifting shapes above. */}
          <m.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-px h-8 bg-gradient-to-b from-primary/50 to-transparent"
            suppressHydrationWarning
          />
        </m.div>
      </m.div>
    </section>
  );
};

export default Hero;
