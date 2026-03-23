import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const stats = [
  { label: "Years Experience", value: "10+" },
  { label: "Companies Led", value: "3" },
  { label: "Successful Exit", value: "1" },
];

const About = () => {
  return (
    <section id="about" className="py-24 lg:py-40">
      <div className="container">
        <div className="grid lg:grid-cols-12 gap-16 lg:gap-8">
          {/* Left column - decorative */}
          <div className="lg:col-span-4">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <span className="font-body text-xs tracking-[0.4em] uppercase text-muted-foreground block mb-8">
                01 — About
              </span>
              <div className="flex flex-col gap-6">
                {stats.map((stat) => (
                  <div key={stat.label} className="border-l-2 border-primary pl-6">
                    <span className="font-display text-4xl font-bold block">{stat.value}</span>
                    <span className="font-body text-sm text-muted-foreground">{stat.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right column - content */}
          <div className="lg:col-span-7 lg:col-start-6">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="font-display text-4xl lg:text-6xl font-bold mb-8 leading-tight">
                I build things
                <br />
                <span className="italic font-normal text-primary">that matter.</span>
              </h2>
              <p className="font-body text-lg text-muted-foreground leading-relaxed mb-8 max-w-xl">
                I'm a hands-on engineering leader, CTO, and former co-founder with a passion for designing robust, scalable software solutions. Over the past decade, I've consistently delivered impactful technology in fast-moving startup environments, Fortune 500 companies, and emerging sectors like blockchain and AI/ML.
              </p>
              <a
                href="https://pratik.pa.tel/_files/ugd/d18f1b_7a4fc93fe56f4edb9c1d3fd318c0dd46.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-body text-sm font-semibold text-foreground border-b-2 border-primary pb-1 hover:text-primary transition-colors"
              >
                Download Resume <ArrowUpRight className="w-4 h-4" />
              </a>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
