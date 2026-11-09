import { BlogPost } from "./types";

export const aRetryIsNotAReplay: BlogPost = {
  slug: "a-retry-is-not-a-replay",
  title: "A Retry Is Not a Replay",
  subtitle:
    "When an agent retries, it makes a new decision with less information than the first time, so the second attempt has to be safe before it is allowed to happen.",
  date: "2026.11",
  dateISO: "2026-11-24",
  readTime: "8 min",
  tags: ["ai", "agents", "reliability", "engineering"],
  image: "/images/blog-a-retry-is-not-a-replay.webp",
  series: "agents-in-production",
};
