import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Terminal, X } from "lucide-react";
import { processTerminalCommand, type TerminalLine } from "@/lib/terminal-commands";
import { useTerminalHistory } from "@/hooks/useTerminalHistory";

const InteractiveTerminal = () => {
  const [open, setOpen] = useState(false);
  const [showButton] = useState(true);
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: "system", text: "Welcome to pratik.pa.tel v3.0.1" },
    { type: "system", text: 'Type "help" for available commands.' },
    { type: "output", text: "" },
  ]);
  const [input, setInput] = useState("");
  const { push, navigateUp, navigateDown } = useTerminalHistory();
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
      const result = processTerminalCommand(cmd, import.meta.env.BASE_URL);

      switch (result.action) {
        case "lines":
          setLines((prev) => [...prev, ...result.lines]);
          break;
        case "clear":
          setLines([]);
          return;
        case "navigate":
          setLines((prev) => [...prev, ...result.lines]);
          setOpen(false);
          setTimeout(() => navigate(result.path), 300);
          break;
        case "scroll":
          setLines((prev) => [...prev, ...result.lines]);
          scrollToSection(result.id);
          break;
        case "open":
          setLines((prev) => [...prev, ...result.lines]);
          window.open(result.url, "_blank");
          break;
        case "empty":
          setLines((prev) => [...prev, { type: "input", text: "$ " }]);
          break;
      }
    },
    [navigate, scrollToSection]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processCommand(input);
    push(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = navigateUp();
      if (prev !== undefined) setInput(prev);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setInput(navigateDown());
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
              className="fixed inset-x-2 sm:inset-x-4 bottom-2 sm:bottom-4 top-auto z-[201] max-w-2xl mx-auto sm:inset-x-auto sm:bottom-8 sm:w-full"
              onClick={() => inputRef.current?.focus()}
            >
              <div className="border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[60vh] sm:max-h-[70vh]">
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
