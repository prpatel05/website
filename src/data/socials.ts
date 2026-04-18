import { Github, Linkedin, Twitter, BookOpen, Code2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface SocialLink {
  name: string;
  url: string;
  icon: LucideIcon;
  handle: string;
}

export const socials: SocialLink[] = [
  { name: "LinkedIn", url: "https://www.linkedin.com/in/prpatel05/", icon: Linkedin, handle: "linkedin.com/in/prpatel05" },
  { name: "GitHub", url: "https://github.com/prpatel05", icon: Github, handle: "github.com/prpatel05" },
  { name: "Medium", url: "https://medium.com/@prpatel05", icon: BookOpen, handle: "medium.com/@prpatel05" },
  { name: "X", url: "https://x.com/prpatel05", icon: Twitter, handle: "x.com/prpatel05" },
  { name: "Dev.to", url: "https://dev.to/prpatel05", icon: Code2, handle: "dev.to/prpatel05" },
];
