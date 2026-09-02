import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "child_process";
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "fs";
import { join } from "path";

// scripts/generate-llms.mjs writes /llms.txt, /llms-full.txt, and a .md alias
// per published post. Copied into a temp repo layout and run for real — same
// approach as generate-feed.test.ts — so the post inventory and body reader
// exercise the same paths the build uses.
const ROOT = process.cwd();
const SCRIPTS = ["generate-llms.mjs", "blog-posts.mjs"];

function post(
  slug: string,
  title: string,
  dateISO: string,
  subtitle: string,
  description?: string,
  tags: string[] = ["ai"]
) {
  return `import { BlogPost } from "./types";
export const p: BlogPost = {
  slug: ${JSON.stringify(slug)},
  title: ${JSON.stringify(title)},
  subtitle: ${JSON.stringify(subtitle)},
${description === undefined ? "" : `  description: ${JSON.stringify(description)},\n`}  date: "2026.07",
  dateISO: ${JSON.stringify(dateISO)},
  readTime: "5 min",
  tags: ${JSON.stringify(tags)},
  image: "/images/x.webp",
  content: \`body\`,
};
`;
}

let workDir: string;
let llms: string;
let full: string;

beforeAll(() => {
  workDir = mkdtempSync(join(ROOT, "llms-test-"));
  mkdirSync(join(workDir, "scripts"));
  mkdirSync(join(workDir, "dist"), { recursive: true });
  const postsDir = join(workDir, "src/data/blog-posts");
  mkdirSync(postsDir, { recursive: true });

  for (const script of SCRIPTS) {
    copyFileSync(join(ROOT, "scripts", script), join(workDir, "scripts", script));
  }

  writeFileSync(join(postsDir, "types.ts"), "export interface BlogPost {}\n");
  writeFileSync(
    join(postsDir, "older.ts"),
    post("older-post", "Older Post", "2026-07-01", "An older subtitle.")
  );
  writeFileSync(
    join(postsDir, "newer.ts"),
    post(
      "newer-post",
      'Newer & "Quoted"',
      "2026-07-14",
      "A newer dek for agents.",
      undefined,
      ["ai", "leadership"]
    )
  );
  writeFileSync(
    join(postsDir, "today.ts"),
    post("today-post", "Today Post", "2026-07-19", "Published this morning.")
  );
  writeFileSync(
    join(postsDir, "tomorrow.ts"),
    post("tomorrow-post", "Tomorrow Post", "2026-07-20", "Not due until tomorrow.")
  );
  writeFileSync(
    join(postsDir, "overridden.ts"),
    post(
      "overridden-post",
      "Overridden Post",
      "2026-07-02",
      "And Why It Matters",
      "A description written to stand on its own for citation."
    )
  );

  mkdirSync(join(postsDir, "content"), { recursive: true });
  writeFileSync(
    join(postsDir, "content", "older-post.md"),
    "The older post opens with a real paragraph.\n\n## Why\n\nMore body after the heading.\n"
  );
  writeFileSync(
    join(postsDir, "content", "newer-post.md"),
    "A newer first paragraph for agents that want more than the dek.\n"
  );

  execFileSync("node", ["scripts/generate-llms.mjs"], {
    cwd: workDir,
    env: { ...process.env, LLMS_TODAY: "2026-07-19" },
  });
  llms = readFileSync(join(workDir, "dist/llms.txt"), "utf-8");
  full = readFileSync(join(workDir, "dist/llms-full.txt"), "utf-8");
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("generate-llms", () => {
  it("starts with the site name and a blockquote summary", () => {
    expect(llms.startsWith("# Pratik Patel\n")).toBe(true);
    expect(llms).toContain(
      "> Notes on AI agents, engineering leadership, and building software when the code is no longer the hard part."
    );
  });

  it("lists published posts with markdown alias URLs and deks", () => {
    expect(llms).toContain(
      "- [Today Post](https://pratik.pa.tel/blog/today-post.md): Published this morning."
    );
    expect(llms).toContain(
      '- [Newer & "Quoted"](https://pratik.pa.tel/blog/newer-post.md): A newer dek for agents.'
    );
    expect(llms).toContain(
      "- [Overridden Post](https://pratik.pa.tel/blog/overridden-post.md): A description written to stand on its own for citation."
    );
    expect(llms).toContain(
      "- [Older Post](https://pratik.pa.tel/blog/older-post.md): An older subtitle."
    );
  });

  it("orders posts newest first, matching the feed", () => {
    const titles = [...llms.matchAll(/^- \[([^\]]+)\]\(/gm)]
      .map((m) => m[1])
      .filter((t) => !["Home", "Blog", "RSS feed", "llms-full.txt", "Sitemap"].includes(t));
    expect(titles).toEqual([
      "Today Post",
      'Newer & "Quoted"',
      "Overridden Post",
      "Older Post",
    ]);
  });

  it("withholds future-dated posts", () => {
    expect(llms).not.toContain("tomorrow-post");
    expect(llms).not.toContain("Tomorrow Post");
    expect(full).not.toContain("Tomorrow Post");
  });

  it("writes a .md alias for every published post into dist/blog", () => {
    for (const slug of [
      "today-post",
      "newer-post",
      "overridden-post",
      "older-post",
    ]) {
      expect(existsSync(join(workDir, "dist/blog", `${slug}.md`))).toBe(true);
    }
    expect(existsSync(join(workDir, "dist/blog", "tomorrow-post.md"))).toBe(
      false
    );
  });

  it("exports front matter and body into the .md alias", () => {
    const md = readFileSync(join(workDir, "dist/blog/newer-post.md"), "utf-8");
    expect(md.startsWith("---\n")).toBe(true);
    expect(md).toContain('title: "Newer & \\"Quoted\\""');
    expect(md).toContain('description: "A newer dek for agents."');
    expect(md).toContain('date: "2026-07-14"');
    expect(md).toContain('tags: ["ai", "leadership"]');
    expect(md).toContain(
      'canonical: "https://pratik.pa.tel/blog/newer-post/"'
    );
    expect(md).toContain(
      "A newer first paragraph for agents that want more than the dek."
    );
  });

  it("still writes an alias when the body markdown file is missing", () => {
    const md = readFileSync(join(workDir, "dist/blog/today-post.md"), "utf-8");
    expect(md).toContain('title: "Today Post"');
    // Front matter only — no body paragraphs after the closing fence.
    const body = md.replace(/^---[\s\S]*?\n---\n?/, "").trim();
    expect(body).toBe("");
  });

  it("ships llms-full.txt with concatenated post bodies", () => {
    expect(full).toContain("# Pratik Patel");
    expect(full).toContain("The older post opens with a real paragraph.");
    expect(full).toContain(
      "A newer first paragraph for agents that want more than the dek."
    );
    expect(full).toContain("Source: https://pratik.pa.tel/blog/older-post/");
    expect(full).toContain("Markdown: https://pratik.pa.tel/blog/older-post.md");
  });
});
