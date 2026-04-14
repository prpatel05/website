import { useState, useCallback } from "react";

export function useTerminalHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const push = useCallback((cmd: string) => {
    if (cmd.trim()) {
      setHistory((prev) => [cmd, ...prev]);
    }
    setHistoryIndex(-1);
  }, []);

  const navigateUp = useCallback((): string | undefined => {
    let result: string | undefined;
    setHistory((h) => {
      setHistoryIndex((prev) => {
        const newIndex = Math.min(prev + 1, h.length - 1);
        result = h[newIndex];
        return newIndex;
      });
      return h;
    });
    return result;
  }, []);

  const navigateDown = useCallback((): string => {
    let result = "";
    setHistory((h) => {
      setHistoryIndex((prev) => {
        const newIndex = Math.max(prev - 1, -1);
        result = newIndex === -1 ? "" : h[newIndex] ?? "";
        return newIndex;
      });
      return h;
    });
    return result;
  }, []);

  return { history, historyIndex, push, navigateUp, navigateDown };
}
