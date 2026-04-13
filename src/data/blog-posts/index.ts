export type { BlogPost } from "./types";
import { shipItYourself } from "./ship-it-yourself";
import { fromCopilotsToColleagues } from "./from-copilots-to-colleagues";
import { thePowerOfSayingNo } from "./the-power-of-saying-no";
import { ownYourCareer } from "./own-your-career";
import { devinAiCoPilot } from "./devin-ai-co-pilot";
import type { BlogPost } from "./types";

export const posts: BlogPost[] = [
  shipItYourself,
  fromCopilotsToColleagues,
  devinAiCoPilot,
  thePowerOfSayingNo,
  ownYourCareer,
];

export const getPostBySlug = (slug: string): BlogPost | undefined => {
  return posts.find((p) => p.slug === slug);
};
