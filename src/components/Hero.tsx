import { ArrowUpRight, Download } from "lucide-react";

const Hero = () => {
  return (
    <section className="min-h-screen flex items-center relative overflow-hidden">
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }} />
      
      <div className="container relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Photo */}
          <div className="relative shrink-0">
            <div className="w-56 h-56 lg:w-72 lg:h-72 rounded-full overflow-hidden ring-2 ring-primary/30 ring-offset-4 ring-offset-background">
              <img
                src="https://static.wixstatic.com/media/d18f1b_523801a612634d4c8898d6555dd2e481~mv2.png/v1/fill/w_556,h_556,fp_0.49_0.51,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/me_enhanced.png"
                alt="Pratik Patel"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary animate-pulse" />
          </div>

          {/* Content */}
          <div className="text-center lg:text-left">
            <p className="text-muted-foreground text-sm tracking-[0.3em] uppercase mb-4 font-body">
              Engineering Leader · CTO · Builder
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-8xl font-bold font-display tracking-tight mb-6">
              PRATIK<br />
              <span className="text-gradient">PATEL</span>
            </h1>
            <p className="text-xl lg:text-2xl text-muted-foreground font-light max-w-xl mb-10 font-body">
              Software Engineer crafting scalable solutions across startups, Fortune 500s, and emerging tech.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a
                href="mailto:pratik@pa.tel"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-full font-display font-semibold text-sm tracking-wide hover:opacity-90 transition-opacity"
              >
                GET IN TOUCH <ArrowUpRight className="w-4 h-4" />
              </a>
              <a
                href="https://pratik.pa.tel/_files/ugd/d18f1b_7a4fc93fe56f4edb9c1d3fd318c0dd46.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-border text-foreground px-8 py-4 rounded-full font-display font-semibold text-sm tracking-wide hover:bg-secondary transition-colors"
              >
                DOWNLOAD RESUME <Download className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
