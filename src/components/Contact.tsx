import { Mail, Phone } from "lucide-react";

const socials = [
  { name: "LinkedIn", url: "https://www.linkedin.com/in/prpatel05/" },
  { name: "GitHub", url: "https://github.com/prpatel05" },
  { name: "Medium", url: "https://medium.com/@prpatel05" },
  { name: "X", url: "https://x.com/prpatel05" },
  { name: "Dev.to", url: "https://dev.to/prpatel05" },
];

const Contact = () => {
  return (
    <section id="contact" className="py-24 lg:py-32">
      <div className="container max-w-3xl text-center">
        <span className="text-primary text-sm font-display tracking-[0.2em] uppercase block mb-4">
          Let's Connect
        </span>
        <h2 className="text-3xl lg:text-5xl font-bold font-display mb-6">
          Get In Touch
        </h2>
        <p className="text-muted-foreground text-lg font-body mb-12 max-w-md mx-auto">
          Always open to interesting conversations, collaborations, and new opportunities.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
          <a
            href="mailto:pratik@pa.tel"
            className="inline-flex items-center gap-3 text-foreground hover:text-primary transition-colors font-body"
          >
            <Mail className="w-5 h-5 text-primary" />
            pratik@pa.tel
          </a>
          <a
            href="tel:+15186369399"
            className="inline-flex items-center gap-3 text-foreground hover:text-primary transition-colors font-body"
          >
            <Phone className="w-5 h-5 text-primary" />
            518-636-9399
          </a>
        </div>

        <div className="flex items-center justify-center gap-6">
          {socials.map((s) => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors text-sm font-display tracking-wide"
            >
              {s.name}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Contact;
