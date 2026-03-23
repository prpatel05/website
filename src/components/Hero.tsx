import { motion } from "framer-motion";
import heroPattern from "@/assets/hero-pattern.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex flex-col justify-end pb-16 lg:pb-24 overflow-hidden">
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <img src={heroPattern} alt="" className="w-full h-full object-cover" width={1920} height={1080} />
        <div className="absolute inset-0 bg-foreground/70" />
      </div>

      {/* Large name */}
      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-background/60 font-body text-sm tracking-[0.4em] uppercase mb-6">
            Software Engineer · CTO · Builder
          </p>
          <h1 className="font-display text-6xl sm:text-8xl lg:text-[10rem] font-bold leading-[0.85] tracking-tight text-background">
            Pratik
            <br />
            <span className="italic font-normal text-primary">Patel</span>
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 1 }}
          className="mt-12 flex items-end justify-between"
        >
          <p className="text-background/70 font-body text-base lg:text-lg max-w-sm leading-relaxed">
            Building the future through code — one scalable system at a time.
          </p>
          <a
            href="#about"
            className="hidden lg:block text-background/40 font-body text-xs tracking-[0.3em] uppercase hover:text-background transition-colors"
          >
            Scroll to explore ↓
          </a>
        </motion.div>
      </div>

      {/* Photo floating element */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="absolute top-1/2 right-8 lg:right-24 -translate-y-1/2 z-10"
      >
        <div className="w-36 h-36 sm:w-48 sm:h-48 lg:w-64 lg:h-64 rounded-2xl overflow-hidden shadow-2xl rotate-3 border-2 border-background/10">
          <img
            src="https://static.wixstatic.com/media/d18f1b_523801a612634d4c8898d6555dd2e481~mv2.png/v1/fill/w_556,h_556,fp_0.49_0.51,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/me_enhanced.png"
            alt="Pratik Patel"
            className="w-full h-full object-cover"
          />
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;
