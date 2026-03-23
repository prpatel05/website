import { motion } from "framer-motion";
import { Github, Linkedin, Twitter, BookOpen, Code2 } from "lucide-react";

const socials = [
  { name: "LinkedIn", url: "https://www.linkedin.com/in/prpatel05/", icon: Linkedin },
  { name: "GitHub", url: "https://github.com/prpatel05", icon: Github },
  { name: "Medium", url: "https://medium.com/@prpatel05", icon: BookOpen },
  { name: "X", url: "https://x.com/prpatel05", icon: Twitter },
  { name: "Dev.to", url: "https://dev.to/prpatel05", icon: Code2 },
];

const Contact = () => {
  return (
    <section id="contact" className="py-24 lg:py-40 relative overflow-hidden">
      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl"
        >
          <span className="font-body text-xs tracking-[0.4em] uppercase text-muted-foreground block mb-4">
            03 — Contact
          </span>
          <h2 className="font-display text-5xl lg:text-7xl font-bold leading-tight mb-8">
            Let's build
            <br />
            <span className="italic font-normal text-primary">something great.</span>
          </h2>
          <p className="font-body text-lg text-muted-foreground max-w-md mb-12">
            Always open to interesting conversations and new opportunities.
          </p>

          <div className="space-y-4 mb-16">
            <a
              href="mailto:pratik@pa.tel"
              className="font-display text-2xl lg:text-4xl font-bold hover:text-primary transition-colors block"
            >
              pratik@pa.tel
            </a>
            <a
              href="tel:+15186369399"
              className="font-body text-lg text-muted-foreground hover:text-foreground transition-colors block"
            >
              518-636-9399
            </a>
          </div>

          <div className="flex items-center gap-4">
            {socials.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={s.name}
                className="w-12 h-12 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
              >
                <s.icon className="w-5 h-5" />
              </a>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Large decorative text */}
      <div className="absolute bottom-0 right-0 font-display text-[12rem] lg:text-[20rem] font-bold text-foreground/[0.03] leading-none select-none pointer-events-none">
        PP
      </div>
    </section>
  );
};

export default Contact;
