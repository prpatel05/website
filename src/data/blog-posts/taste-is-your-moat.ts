import { BlogPost } from "./types";

export const tasteIsYourMoat: BlogPost = {
  slug: "taste-is-your-moat",
  title: "Your Taste Is Your Moat",
  subtitle:
    "AI made execution cheap. The scarce resource now is knowing what to build.",
  date: "2026.05",
  dateISO: "2026-05-12",
  readTime: "6 min",
  tags: ["ai", "engineering", "leadership", "product"],
  image: "/images/blog-taste-is-your-moat.webp",
  content: `Last month I watched someone build a full SaaS app in 45 minutes using AI tools. Working backend, auth, payments, dashboard. It was genuinely impressive.

It was also completely useless. Nobody wanted it.

The app worked perfectly. It just solved a problem that didn't exist, in a way that nobody would choose to use, with a UI that felt like it was designed by committee. Every technical box was checked. Every product instinct was wrong.

This is the new failure mode. And I'm seeing it everywhere.

## Execution Is No Longer the Hard Part

For twenty years, the bottleneck in software was building the thing. You had an idea, and the gap between that idea and a working product was months of engineering, tens of thousands of dollars, and a team of specialists.

AI collapsed that gap to almost nothing. I wrote about this in "The $0 Startup." The tools exist. The cost is near zero. Anyone can ship.

Which means shipping isn't the differentiator anymore. If everyone can build, the question stops being "can you build it?" and becomes "should you build it?" And more importantly: "should you build it *this way*?"

That's taste. And right now, it's the scarcest resource in tech.

## What Taste Actually Means

Taste isn't about aesthetics. It's not "make it look pretty." It's the ability to make a thousand small decisions correctly without having to reason through each one from first principles.

Should this button be here or there? Should this feature exist at all? Should we ship this now or wait until we've talked to ten more users? Should this error message be technical or friendly? Should this API return one object or a list?

Each decision is tiny. Each one barely matters on its own. But they compound. A product built by someone with good taste feels *right* in a way that's hard to articulate but impossible to miss. A product built without it feels off, even when nothing is technically broken.

Steve Jobs talked about this constantly. So did Dieter Rams. But you don't have to be a design legend to have taste. You just have to care about the details that most people skip.

## The AI Taste Gap

AI tools are fantastic at execution. Give Claude or Cursor a well-defined task and it'll produce clean, working code faster than most engineers. But ask it to decide *what* to build? That's where things fall apart.

I've tested this repeatedly. When I give an AI agent a specific, well-scoped task with clear context, the output is great. When I give it an open-ended problem, "build something that helps developers manage their dotfiles," the result is technically competent and creatively dead. It builds the obvious thing. The thing that already exists twelve times on GitHub.

AI doesn't have taste because taste comes from experience, opinions, and the willingness to say no to things that technically work. AI is a people-pleaser. It'll build whatever you ask for. It won't push back and say "that feature is a bad idea" or "your users don't actually want that."

That pushback is where taste lives.

## Three Things I've Learned About Taste

### 1. Taste is mostly about removal

The best product decisions I've made weren't about what to add. They were about what to cut. The feature that seemed important but would confuse the core flow. The settings page that gave users control they'd never use. The onboarding step that felt necessary but killed activation.

Junior engineers add. Senior engineers remove. The willingness to kill something that took a week to build, because it makes the overall product worse, is one of the clearest signals of taste I know.

### 2. Taste requires contact with real users

You can't develop taste in isolation. Every product instinct I trust was built by watching someone struggle with software I built. Not reading analytics dashboards. Not reviewing survey results. Sitting next to someone and watching them try to complete a task.

The founders I know who ship great products all do some version of this. They talk to users constantly. Not through feedback forms. Through actual conversations where they shut up and watch.

AI can't do this. It can analyze usage data. It can summarize feedback. But it can't sit in a room and notice that a user paused for three seconds before clicking a button, and understand what that pause means.

### 3. Taste compounds like interest

Every product you ship, every user interaction you observe, every decision you make and see the result of, it all accumulates. Five years of building products gives you intuitions that no amount of reading or theorizing can replicate.

This is why experienced product builders are more valuable now than ever. Not less. The execution layer got automated. The judgment layer didn't. A founder with ten years of product sense and AI tools is a force multiplier. A founder with AI tools and no product sense is just building faster in the wrong direction.

## What This Means for Engineers

If you're an engineer reading this, the implication is clear: technical skill alone isn't enough anymore. It never was, really, but now the gap is obvious.

The engineers I want to work with aren't just good coders. They're people who ask "why are we building this?" before they ask "how should we build this?" They're the ones who push back on specs that don't make sense. Who prototype three different approaches and pick the one that *feels* right, not just the one that's technically cleanest.

You build taste by building things. Ship side projects. Use your own products. Pay attention to what annoys you about software you use every day. Develop opinions. Strong ones. Be willing to be wrong, but always have a point of view.

## The New Competitive Advantage

The next decade of tech belongs to people with good taste and access to AI tools. Not to the people with the best AI tools and no taste.

Execution is a commodity now. Taste isn't. If you're wondering what to invest in, invest in your judgment. Talk to users. Ship things. Develop opinions about what good software feels like.

The moat isn't your code. It's your ability to decide what code should exist.`,
};
