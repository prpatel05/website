import { Code2 } from "lucide-react";

const About = () => {
  return (
    <section id="about" className="py-24 lg:py-32">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
            <img
              src="https://static.wixstatic.com/media/nsplsh_634f6b7054694a4d477a41~mv2_d_2848_2848_s_4_2.jpg/v1/fill/w_845,h_634,fp_0.50_0.63,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/Image%20by%20Oskar%20Yildiz.jpg"
              alt="Code on screen"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          </div>

          <div>
            <div className="inline-flex items-center gap-2 text-primary mb-6">
              <Code2 className="w-5 h-5" />
              <span className="text-sm font-display tracking-[0.2em] uppercase">About Me</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold font-display mb-6">
              Software Engineer
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed font-body">
              I'm Pratik Patel—a hands-on engineering leader, CTO, and former co-founder (exit) with a passion for designing robust, scalable software solutions. Over the past decade, I've consistently delivered impactful technology in fast-moving startup environments, Fortune 500 companies, and emerging sectors like blockchain and AI/ML.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
