import { BlogPost } from "./types";

export const yourContextWindowIsABudget: BlogPost = {
  slug: "your-context-window-is-a-budget",
  title: "Your Context Window Is a Budget",
  subtitle:
    "The API already injects a tag into the system prompt called token_budget, and counts it down after every tool call. The benchmarks agree: models that claim 128K and 200K tokens stop being reliable at 64K and 32K. The window is an allocation, not a container, and almost no architecture treats it that way.",
  date: "2026.10",
  dateISO: "2026-10-06",
  readTime: "9 min",
  tags: ["ai", "agents", "engineering", "operations", "context"],
  image: "/images/blog-your-context-window-is-a-budget.webp",
};
