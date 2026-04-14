import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useState, useRef } from "react";

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

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const photoY = useTransform(scrollYProgress, [0, 1], ["0%", "-20%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);
  const statusX = useTransform(scrollYProgress, [0, 1], ["0px", "-40px"]);

  useEffect(() => {
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
  }, [displayText, isDeleting, roleIndex]);

  return (
    <section ref={sectionRef} className="relative min-h-screen flex items-center overflow-hidden grid-bg px-4 sm:px-0">
      {/* Parallax floating geometric elements */}
      <motion.div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ y: bgY }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute -top-32 -right-32 w-96 h-96 border border-primary/10 rounded-full"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-20 -left-20 w-72 h-72 border border-accent/10 rounded-full"
        />
        <motion.div
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 right-1/4 w-2 h-2 bg-primary rounded-full opacity-60"
        />
        <motion.div
          animate={{ y: [0, 15, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-2/3 left-1/3 w-1.5 h-1.5 bg-accent rounded-full opacity-40"
        />
        <motion.div
          animate={{ x: [0, 10, 0], y: [0, -10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 left-1/4 w-1 h-1 bg-primary/40 rounded-full"
        />
        <motion.div
          animate={{ x: [0, -8, 0], y: [0, 12, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 right-1/3 w-1 h-8 bg-gradient-to-b from-primary/20 to-transparent"
        />
      </motion.div>

      {/* Terminal-like status bar with parallax */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        style={{ x: statusX, opacity }}
        className="absolute top-24 left-8 hidden lg:flex flex-col gap-4 font-mono text-[10px] text-muted-foreground"
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
      </motion.div>

      <motion.div className="container relative z-10" style={{ y: textY, opacity, scale }}>
        <div className="max-w-4xl">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="font-mono text-xs text-primary/60 mb-6 tracking-widest"
          >
            {'>'} initializing portfolio...
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-5xl sm:text-7xl lg:text-9xl font-bold leading-[0.9] tracking-tighter"
          >
            <span className="text-foreground">Pratik</span>
            <br />
            <span className="text-primary text-glow">Patel</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-6 sm:mt-8 font-mono text-base sm:text-xl text-muted-foreground"
          >
            <span className="text-primary/50">$ </span>
            <span className="text-foreground/80">{displayText}</span>
            <span className="text-primary cursor-blink ml-0.5">▊</span>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mt-6 sm:mt-8 font-mono text-xs sm:text-sm text-muted-foreground max-w-lg leading-relaxed"
          >
            Technology executive and hands-on architect with 11+ years building
            and scaling engineering organizations. Three-time company builder
            with a successful acquisition under the belt.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.6 }}
            className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4"
          >
            <a
              href="#contact"
              className="font-mono text-sm bg-primary text-primary-foreground px-6 py-3 hover:bg-primary/90 transition-colors box-glow text-center"
            >
              ./contact --init
            </a>
            <a
              href={`${import.meta.env.BASE_URL}resume.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm border border-primary/30 text-primary px-6 py-3 hover:bg-primary/10 transition-colors text-center"
            >
              cat resume.pdf
            </a>
          </motion.div>
        </div>

        {/* Photo with parallax */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: 0.6, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{ y: photoY }}
          className="absolute bottom-0 right-0 lg:right-12 hidden md:block"
        >
          <div className="relative">
            <div className="w-56 h-56 lg:w-72 lg:h-72 overflow-hidden border border-primary/20 box-glow">
              <img
                src="/images/headshot.png"
                alt="Pratik Patel"
                width={288}
                height={288}
                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
              />
            </div>
            <div className="absolute -bottom-3 -right-3 font-mono text-[10px] text-primary/40 border border-primary/10 px-2 py-1 bg-background">
              v3.0.1
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        style={{ opacity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="font-mono text-[10px] text-muted-foreground tracking-widest">SCROLL</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-px h-8 bg-gradient-to-b from-primary/50 to-transparent"
        />
      </motion.div>
    </section>
  );
};

export default Hero;
