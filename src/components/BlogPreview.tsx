import { ArrowUpRight } from "lucide-react";

const posts = [
  {
    title: "The Power of Saying No (And How It Can Save Your Sanity)",
    excerpt: 'Early in my career, I was that engineer. The "Yes Person™." "Can you take on this extra feature?" Yes! "Can we launch a week early?"...',
    date: "Feb 21, 2025",
    readTime: "4 min read",
    image: "https://static.wixstatic.com/media/d18f1b_f04531a4585c430880bbd355f2dd7f98~mv2.webp/v1/fill/w_534,h_401,al_c,q_90,enc_avif,quality_auto/d18f1b_f04531a4585c430880bbd355f2dd7f98~mv2.webp",
    url: "https://pratik.pa.tel/post/the-power-of-saying-no-and-how-it-can-save-your-sanity",
  },
  {
    title: "Own Your Career: 5 Lessons to Drive Your Promotions",
    excerpt: "Don't wait for someone to recognize your value. Learn how to take control of your career path, secure high-impact projects, and own your promotions.",
    date: "Feb 19, 2025",
    readTime: "6 min read",
    image: "https://static.wixstatic.com/media/d18f1b_d83ba35b2f924796ab362adb52e9465f~mv2.webp/v1/fill/w_534,h_401,al_c,q_90,enc_avif,quality_auto/d18f1b_d83ba35b2f924796ab362adb52e9465f~mv2.webp",
    url: "https://pratik.pa.tel/post/own-your-career-5-lessons-to-drive-your-promotions",
  },
];

const BlogPreview = () => {
  return (
    <section id="blog" className="py-24 lg:py-32 bg-secondary/30">
      <div className="container">
        <div className="flex items-end justify-between mb-16">
          <div>
            <span className="text-primary text-sm font-display tracking-[0.2em] uppercase block mb-4">
              Latest Thoughts
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold font-display">
              From the Blog
            </h2>
          </div>
          <a
            href="https://pratik.pa.tel/blog"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1 text-primary font-display text-sm hover:opacity-80 transition-opacity"
          >
            View All <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {posts.map((post) => (
            <a
              key={post.title}
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/40 transition-colors"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-6 lg:p-8">
                <div className="flex items-center gap-3 text-muted-foreground text-xs font-body mb-3">
                  <span>{post.date}</span>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                  <span>{post.readTime}</span>
                </div>
                <h3 className="text-lg font-semibold font-display mb-2 group-hover:text-primary transition-colors">
                  {post.title}
                </h3>
                <p className="text-muted-foreground text-sm font-body line-clamp-2">
                  {post.excerpt}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BlogPreview;
