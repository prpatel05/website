export interface TerminalLine {
  type: "input" | "output" | "error" | "system";
  text: string;
}

export const COMMANDS: Record<string, string> = {
  help: "Show available commands",
  about: "Navigate to about section",
  blog: "Open blog archive",
  contact: "Navigate to contact section",
  resume: "Download resume",
  socials: "List social links",
  skills: "Show tech stack",
  clear: "Clear terminal",
  whoami: "About Pratik",
  neofetch: "System info",
  ls: "List site sections",
  pwd: "Print working directory",
  date: "Show current date",
  echo: "Echo a message",
};

export const ASCII_LOGO = `
  ██████╗ ██████╗
  ██╔══██╗██╔══██╗
  ██████╔╝██████╔╝
  ██╔═══╝ ██╔═══╝
  ██║     ██║
  ╚═╝     ╚═╝
`;

export type CommandResult =
  | { action: "lines"; lines: TerminalLine[] }
  | { action: "clear" }
  | { action: "navigate"; path: string; lines: TerminalLine[] }
  | { action: "scroll"; id: string; lines: TerminalLine[] }
  | { action: "open"; url: string; lines: TerminalLine[] }
  | { action: "empty" };

/**
 * Pure function that processes a terminal command and returns the result.
 * Side effects (navigation, scrolling, opening URLs) are returned as action descriptors.
 */
export function processTerminalCommand(
  cmd: string,
  baseUrl: string = "/"
): CommandResult {
  const trimmed = cmd.trim().toLowerCase();
  const parts = trimmed.split(" ");
  const base = parts[0];

  const wrapLines = (newLines: TerminalLine[]): CommandResult => ({
    action: "lines",
    lines: [{ type: "input", text: `$ ${cmd}` }, ...newLines, { type: "output", text: "" }],
  });

  switch (base) {
    case "help":
      return wrapLines([
        { type: "system", text: "┌─ Available Commands ─────────────────┐" },
        ...Object.entries(COMMANDS).map(([k, v]) => ({
          type: "output" as const,
          text: `  ${k.padEnd(12)} ${v}`,
        })),
        { type: "system", text: "└──────────────────────────────────────┘" },
        { type: "output", text: "  Tip: Ctrl+K to toggle terminal" },
      ]);

    case "about":
      return {
        action: "scroll" as const,
        id: "about",
        lines: wrapLines([{ type: "system", text: "→ Navigating to #about..." }]).lines,
      };

    case "contact":
      return {
        action: "scroll" as const,
        id: "contact",
        lines: wrapLines([{ type: "system", text: "→ Navigating to #contact..." }]).lines,
      };

    case "blog":
      return {
        action: "navigate" as const,
        path: "/blog",
        lines: wrapLines([{ type: "system", text: "→ Opening /blog..." }]).lines,
      };

    case "resume":
      return {
        action: "open" as const,
        url: `${baseUrl}resume.pdf`,
        lines: wrapLines([{ type: "system", text: "→ Downloading resume.pdf..." }]).lines,
      };

    case "socials":
      return wrapLines([
        { type: "system", text: "┌─ Social Links ───────────────────────┐" },
        { type: "output", text: "  LinkedIn    linkedin.com/in/prpatel05" },
        { type: "output", text: "  GitHub      github.com/prpatel05" },
        { type: "output", text: "  Medium      medium.com/@prpatel05" },
        { type: "output", text: "  X/Twitter   x.com/prpatel05" },
        { type: "output", text: "  Dev.to      dev.to/prpatel05" },
        { type: "system", text: "└──────────────────────────────────────┘" },
      ]);

    case "skills":
      return wrapLines([
        { type: "system", text: "┌─ Tech Stack ─────────────────────────┐" },
        { type: "output", text: "  TypeScript/JS  ████████████████████░ 95%" },
        { type: "output", text: "  React/Next.js  ██████████████████░░░ 92%" },
        { type: "output", text: "  Node.js/Bun    ██████████████████░░░ 90%" },
        { type: "output", text: "  AWS/Cloud      ██████████████████░░░ 92%" },
        { type: "output", text: "  AI/ML/LLMs     █████████████████░░░░ 88%" },
        { type: "output", text: "  Python/Go      █████████████████░░░░ 85%" },
        { type: "output", text: "  Blockchain     █████████████████░░░░ 85%" },
        { type: "system", text: "└──────────────────────────────────────┘" },
      ]);

    case "whoami":
      return wrapLines([
        { type: "output", text: ASCII_LOGO },
        { type: "system", text: "  Pratik Patel" },
        { type: "output", text: "  CTO & Chief Architect · 3x Company Builder" },
        { type: "output", text: "  11+ years · AI · Cloud · Web3" },
        { type: "output", text: "  Washington, DC | pratik@pa.tel" },
      ]);

    case "neofetch":
      return wrapLines([
        { type: "system", text: "  pratik@portfolio" },
        { type: "system", text: "  ─────────────────" },
        { type: "output", text: "  OS:       React 18 + Vite" },
        { type: "output", text: "  Shell:    pratik.pa.tel v3.0" },
        { type: "output", text: "  Theme:    Cyberpunk Dark" },
        { type: "output", text: "  Font:     JetBrains Mono" },
        { type: "output", text: "  Uptime:   11+ years" },
        { type: "output", text: "  Location: Washington, DC" },
      ]);

    case "clear":
      return { action: "clear" };

    case "ls":
      return wrapLines([
        { type: "output", text: "  drwxr-xr-x  about/" },
        { type: "output", text: "  drwxr-xr-x  blog/" },
        { type: "output", text: "  drwxr-xr-x  contact/" },
        { type: "output", text: "  -rw-r--r--  resume.pdf" },
      ]);

    case "pwd":
      return wrapLines([{ type: "output", text: "  /home/pratik/portfolio" }]);

    case "date":
      return wrapLines([{ type: "output", text: `  ${new Date().toString()}` }]);

    case "echo":
      return wrapLines([{ type: "output", text: `  ${parts.slice(1).join(" ") || ""}` }]);

    case "":
      return { action: "empty" };

    default:
      return wrapLines([
        { type: "error", text: `  command not found: ${base}` },
        { type: "output", text: '  Type "help" for available commands.' },
      ]);
  }
}
