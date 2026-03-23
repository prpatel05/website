import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const posts = [
  {
    title: "The Power of Saying No",
    subtitle: "And How It Can Save Your Sanity",
    excerpt: 'Early in my career, I was that engineer. The "Yes Person™." Learning to say no changed everything.',
    date: "Feb 2025",
    readTime: "4 min",
    image: "https://static.wixstatic.com/media/d18f1b_f04531a4585c430880bbd355f2dd7f98~mv2.webp/v1/fill/w_534,h_401,al_c,q_90,enc_avif,quality_auto/d18f1b_f04531a4585c430880bbd355f2dd7f98~mv2.webp",
    url: "https://pratik.pa.tel/post/the-power-of-saying-no-and-how-it-can-save-your-sanity",
  },
  {
    title: "Own Your Career",
    subtitle: "5 Lessons to Drive Your Promotions",
    excerpt: "Don't wait for someone to recognize your value. Take control of your career path and own your promotions.",
    date: "Feb 2025",
    readTime: "6 min",
    image: "https://static.wixstatic.com/media/d18f1b_d83ba35b2f924796ab362adb52e9465f~mv2.webp/v1/fill/w_534,h_401,al_c,q_90,enc_avif,quality_auto/d18f1b_d83ba35b2f924796ab362adb52e9465f~mv2.webp",
    url: "https://pratik.pa.tel/post/own-your-career-5-lessons-to-drive-your-promotions",
  },
];

const BlogPreview = () => {
  return (
    <section id="writing" className="py-24 lg:py-40 bg-card">
      <div className="container">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="font-body text-xs tracking-[0.4em] uppercase text-muted-foreground block mb-4">
            02 — Writing
          </span>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-16">
            <h2 className="font-display text-4xl lg:text-6xl font-bold leading-tight">
              Recent <span className="italic font-normal text-primary">thoughts</span>
            </h2>
            <a
              href="https://pratik.pa.tel/blog"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-body text-sm text-muted-foreground hover:text-primary transition-colors mt-4 sm:mt-0"
            >
              All posts <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </motion.div>

        <div className="space-y-0 divide-y divide-border">
          {posts.map((post, i) => (
            <motion.a
              key={post.title}
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="group grid md:grid-cols-12 gap-6 py-10 lg:py-14 items-center"
            >
              <div className="md:col-span-2">
                <div className="w-full aspect-square rounded-xl overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    loading="lazy"
                  />
                </div>
              </div>
              <div className="md:col-span-8">
                <span className="font-body text-xs text-muted-foreground mb-2 block">
                  {post.date} · {post.readTime}
                </span>
                <h3 className="font-display text-2xl lg:text-3xl font-bold group-hover:text-primary transition-colors">
                  {post.title}
                </h3>
                <p className="font-display text-lg text-muted-foreground italic mt-1">
                  {post.subtitle}
                </p>
              </div>
              <div className="md:col-span-2 flex md:justify-end">
                <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center group-hover:bg-primary group-hover:border-primary group-hover:text-primary-foreground transition-all">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BlogPreview;
