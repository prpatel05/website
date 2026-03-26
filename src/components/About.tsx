import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const skills = [
  { name: "TypeScript / JavaScript", level: 95 },
  { name: "React / Next.js", level: 92 },
  { name: "Node.js / Bun", level: 90 },
  { name: "AWS / Cloud / Infra", level: 92 },
  { name: "AI / ML / LLMs", level: 88 },
  { name: "Python / Go", level: 85 },
  { name: "Blockchain / Web3", level: 85 },
];

const stats = [
  { value: "11+", label: "years_exp" },
  { value: "3x", label: "companies_built" },
  { value: "1", label: "acquisition" },
  { value: "50K+", label: "users_shipped" },
];

const About = () => {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const leftX = useTransform(scrollYProgress, [0, 0.4], ["-60px", "0px"]);
  const rightX = useTransform(scrollYProgress, [0, 0.4], ["60px", "0px"]);
  const sectionOpacity = useTransform(scrollYProgress, [0, 0.15], [0, 1]);
  const scanlineY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  return (
    <section ref={sectionRef} id="about" className="py-16 sm:py-24 lg:py-40 relative overflow-hidden">
      <motion.div className="absolute inset-0 scanline pointer-events-none" style={{ y: scanlineY }} />
      <motion.div className="container relative z-10" style={{ opacity: sectionOpacity }}>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="font-mono text-xs text-primary/60 tracking-widest block mb-2">
            {'// section:about'}
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-6xl font-bold mb-4">
            <span className="text-foreground">About</span>{" "}
            <span className="text-primary text-glow">me</span>
          </h2>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-16 mt-12">
          {/* Left - bio with parallax slide-in */}
          <motion.div style={{ x: leftX }}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="border border-border bg-card p-6 lg:p-8 relative">
                <div className="absolute top-0 left-0 right-0 h-8 bg-muted border-b border-border flex items-center px-4 gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-primary/40" />
                  <span className="w-2.5 h-2.5 rounded-full bg-primary/60" />
                  <span className="font-mono text-[10px] text-muted-foreground ml-3">about.md</span>
                </div>
                <div className="mt-8 font-mono text-sm text-muted-foreground leading-relaxed space-y-4">
                  <p>
                    Technology executive and hands-on architect with 11+ years
                    building and scaling engineering organizations and shipping
                    products to hundreds of thousands of users.
                  </p>
                  <p>
                    Three-time company builder: grew a 30-person engineering org at{" "}
                    <span className="text-primary">AWS</span>, co-founded and sold a
                    blockchain studio via acquisition by{" "}
                    <span className="text-accent text-glow-accent">Dapper Labs</span>,
                    and took a healthtech startup from napkin sketch to 50K+ users as
                    founding CTO.
                  </p>
                  <p>
                    Currently Chief Architect at{" "}
                    <span className="text-primary">Tarobase (poof.new)</span>,
                    building AI-powered tools for vibe-coded dApps. Proven ability
                    to set technical strategy, recruit world-class teams, and raise
                    venture capital.
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 mt-6">
                {stats.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
                    className="border border-border bg-card p-4 text-center"
                  >
                    <span className="font-display text-2xl lg:text-3xl font-bold text-primary text-glow block">
                      {stat.value}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground tracking-wider">
                      {stat.label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Right - skills with parallax slide-in */}
          <motion.div style={{ x: rightX }}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="border border-border bg-card p-6 lg:p-8 relative">
                <div className="absolute top-0 left-0 right-0 h-8 bg-muted border-b border-border flex items-center px-4 gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-primary/40" />
                  <span className="w-2.5 h-2.5 rounded-full bg-primary/60" />
                  <span className="font-mono text-[10px] text-muted-foreground ml-3">skills.config</span>
                </div>
                <div className="mt-8 space-y-5">
                  {skills.map((skill, i) => (
                    <motion.div
                      key={skill.name}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.4 + i * 0.08, duration: 0.4 }}
                    >
                      <div className="flex justify-between mb-1.5">
                        <span className="font-mono text-xs text-foreground/80">{skill.name}</span>
                        <span className="font-mono text-xs text-primary">{skill.level}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${skill.level}%` }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.6 + i * 0.08, duration: 0.8, ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default About;
