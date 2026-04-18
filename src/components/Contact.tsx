import { motion, useTransform } from "framer-motion";
import { Mail, Phone } from "lucide-react";
import { socials } from "@/data/socials";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import SectionHeader from "./SectionHeader";

const Contact = () => {
  const { ref, scrollYProgress, sectionOpacity } = useScrollAnimation({
    opacityRange: [0, 0.2],
  });

  const decorY = useTransform(scrollYProgress, [0, 1], ["100px", "-60px"]);

  return (
    <section ref={ref} id="contact" className="py-16 sm:py-24 lg:py-40 relative overflow-hidden">
      <div className="absolute inset-0 scanline pointer-events-none" />
      <motion.div className="container relative z-10" style={{ opacity: sectionOpacity }}>
        <SectionHeader label="// section:contact" titleLeft="Let's" titleRight="connect">
          <h2 className="font-display text-3xl sm:text-5xl lg:text-7xl font-bold mb-6">
            <span className="text-foreground">Let's</span>{" "}
            <span className="text-primary text-glow">connect</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground max-w-md mb-12">
            Always open to interesting conversations, new opportunities,
            and building things that matter. Based in Washington, DC — open to remote.
          </p>
        </SectionHeader>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Direct contact */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            <a
              href="mailto:pratik@pa.tel"
              className="group flex items-center gap-4 border border-border bg-card p-5 hover:border-primary/40 hover:box-glow transition-all duration-500"
            >
              <Mail className="w-5 h-5 text-primary shrink-0" />
              <div>
                <span className="font-mono text-[10px] text-muted-foreground block">email</span>
                <span className="font-mono text-sm text-foreground group-hover:text-primary transition-colors">
                  pratik@pa.tel
                </span>
              </div>
            </a>
            <a
              href="tel:+15186369399"
              className="group flex items-center gap-4 border border-border bg-card p-5 hover:border-primary/40 hover:box-glow transition-all duration-500"
            >
              <Phone className="w-5 h-5 text-accent shrink-0" />
              <div>
                <span className="font-mono text-[10px] text-muted-foreground block">phone</span>
                <span className="font-mono text-sm text-foreground group-hover:text-accent transition-colors">
                  (518) 636-9399
                </span>
              </div>
            </a>
          </motion.div>

          {/* Social grid */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-3 sm:grid-cols-5 gap-3"
          >
            {socials.map((s, i) => (
              <motion.a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 + i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="group flex flex-col items-center gap-2 border border-border bg-card p-4 hover:border-primary/40 hover:box-glow transition-all duration-500"
              >
                <s.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="font-mono text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                  {s.name}
                </span>
              </motion.a>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Background decoration with parallax */}
      <motion.div
        style={{ y: decorY }}
        className="absolute bottom-0 right-0 font-mono text-[10rem] lg:text-[18rem] font-bold text-primary/[0.03] leading-none select-none pointer-events-none"
      >
        {'/>'}
      </motion.div>
    </section>
  );
};

export default Contact;
