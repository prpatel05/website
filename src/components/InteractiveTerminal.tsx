import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Terminal, X } from "lucide-react";

interface TerminalLine {
  type: "input" | "output" | "error" | "system";
  text: string;
}

const COMMANDS: Record<string, string> = {
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

const ASCII_LOGO = `
  ██████╗ ██████╗ 
  ██╔══██╗██╔══██╗
  ██████╔╝██████╔╝
  ██╔═══╝ ██╔═══╝ 
  ██║     ██║     
  ╚═╝     ╚═╝     
`;

const InteractiveTerminal = () => {
  const [open, setOpen] = useState(false);
  const [showButton] = useState(true);
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: "system", text: "Welcome to pratik.pa.tel v3.0.1" },
    { type: "system", text: 'Type "help" for available commands.' },
    { type: "output", text: "" },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);


  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  // Keyboard shortcut to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const scrollToSection = useCallback((id: string) => {
    setOpen(false);
    setTimeout(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: "smooth" });
    }, 300);
  }, []);

  const processCommand = useCallback(
    (cmd: string) => {
      const trimmed = cmd.trim().toLowerCase();
      const parts = trimmed.split(" ");
      const base = parts[0];

      const addLines = (newLines: TerminalLine[]) => {
        setLines((prev) => [...prev, { type: "input", text: `$ ${cmd}` }, ...newLines, { type: "output", text: "" }]);
      };

      switch (base) {
        case "help":
          addLines([
            { type: "system", text: "┌─ Available Commands ─────────────────┐" },
            ...Object.entries(COMMANDS).map(([k, v]) => ({
              type: "output" as const,
              text: `  ${k.padEnd(12)} ${v}`,
            })),
            { type: "system", text: "└──────────────────────────────────────┘" },
            { type: "output", text: "  Tip: Ctrl+K to toggle terminal" },
          ]);
          break;

        case "about":
          addLines([{ type: "system", text: "→ Navigating to #about..." }]);
          scrollToSection("about");
          break;

        case "contact":
          addLines([{ type: "system", text: "→ Navigating to #contact..." }]);
          scrollToSection("contact");
          break;

        case "blog":
          addLines([{ type: "system", text: "→ Opening /blog..." }]);
          setOpen(false);
          setTimeout(() => navigate("/blog"), 300);
          break;

        case "resume":
          addLines([{ type: "system", text: "→ Downloading resume.pdf..." }]);
          window.open("/pratik-patel-resume.pdf", "_blank");
          break;

        case "socials":
          addLines([
            { type: "system", text: "┌─ Social Links ───────────────────────┐" },
            { type: "output", text: "  LinkedIn    linkedin.com/in/prpatel05" },
            { type: "output", text: "  GitHub      github.com/prpatel05" },
            { type: "output", text: "  Medium      medium.com/@prpatel05" },
            { type: "output", text: "  X/Twitter   x.com/prpatel05" },
            { type: "output", text: "  Dev.to      dev.to/prpatel05" },
            { type: "system", text: "└──────────────────────────────────────┘" },
          ]);
          break;

        case "skills":
          addLines([
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
          break;

        case "whoami":
          addLines([
            { type: "output", text: ASCII_LOGO },
            { type: "system", text: "  Pratik Patel" },
            { type: "output", text: "  CTO & Chief Architect · 3x Company Builder" },
            { type: "output", text: "  11+ years · AI · Cloud · Web3" },
            { type: "output", text: "  Washington, DC | pratik@pa.tel" },
          ]);
          break;

        case "neofetch":
          addLines([
            { type: "system", text: "  pratik@portfolio" },
            { type: "system", text: "  ─────────────────" },
            { type: "output", text: "  OS:       React 18 + Vite" },
            { type: "output", text: "  Shell:    pratik.pa.tel v3.0" },
            { type: "output", text: "  Theme:    Cyberpunk Dark" },
            { type: "output", text: "  Font:     JetBrains Mono" },
            { type: "output", text: "  Uptime:   11+ years" },
            { type: "output", text: `  Location: Washington, DC` },
          ]);
          break;

        case "clear":
          setLines([]);
          return;

        case "ls":
          addLines([
            { type: "output", text: "  drwxr-xr-x  about/" },
            { type: "output", text: "  drwxr-xr-x  blog/" },
            { type: "output", text: "  drwxr-xr-x  contact/" },
            { type: "output", text: "  -rw-r--r--  resume.pdf" },
          ]);
          break;

        case "pwd":
          addLines([{ type: "output", text: "  /home/pratik/portfolio" }]);
          break;

        case "date":
          addLines([{ type: "output", text: `  ${new Date().toString()}` }]);
          break;

        case "echo":
          addLines([{ type: "output", text: `  ${parts.slice(1).join(" ") || ""}` }]);
          break;

        case "":
          setLines((prev) => [...prev, { type: "input", text: "$ " }]);
          break;

        default:
          addLines([
            { type: "error", text: `  command not found: ${base}` },
            { type: "output", text: '  Type "help" for available commands.' },
          ]);
      }
    },
    [navigate, scrollToSection]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processCommand(input);
    if (input.trim()) {
      setHistory((prev) => [input, ...prev]);
    }
    setInput("");
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(newIndex);
      if (history[newIndex]) setInput(history[newIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIndex);
      setInput(newIndex === -1 ? "" : history[newIndex]);
    }
  };

  return (
    <>
      {/* Toggle button */}
      <AnimatePresence>
        {showButton && !open && (
          <motion.button
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-card border border-border flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 group"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Open terminal (Ctrl+K)"
          >
            <Terminal className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Terminal overlay */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-background/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-4 bottom-4 top-auto z-[201] max-w-2xl mx-auto sm:inset-x-auto sm:bottom-8 sm:w-full"
              onClick={() => inputRef.current?.focus()}
            >
              <div className="border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
                {/* Title bar */}
                <div className="h-9 bg-muted border-b border-border flex items-center px-4 gap-2 shrink-0">
                  <button onClick={() => setOpen(false)} className="w-3 h-3 rounded-full bg-destructive/60 hover:bg-destructive transition-colors" />
                  <span className="w-3 h-3 rounded-full bg-primary/40" />
                  <span className="w-3 h-3 rounded-full bg-primary/60" />
                   <span className="font-mono text-[10px] text-muted-foreground ml-3 flex-1 text-center">
                     pratik.pa.tel — bash
                   </span>
                  <button
                    onClick={() => setOpen(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Output */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed min-h-[200px]">
                  {lines.map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.type === "input"
                          ? "text-foreground/80"
                          : line.type === "error"
                          ? "text-destructive"
                          : line.type === "system"
                          ? "text-primary"
                          : "text-muted-foreground"
                      }
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      {line.text}
                    </div>
                  ))}
                </div>

                {/* Input */}
                <form onSubmit={handleSubmit} className="border-t border-border px-4 py-3 flex items-center gap-2 shrink-0">
                  <span className="text-primary font-mono text-xs">$</span>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/40 caret-primary"
                    placeholder='type "help" to get started...'
                    autoComplete="off"
                    spellCheck={false}
                  />
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default InteractiveTerminal;
