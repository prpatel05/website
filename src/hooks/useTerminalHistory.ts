import { useCallback, useRef, useState } from "react";

/**
 * Command history for the terminal, with the draft slot every shell has.
 *
 * The cursor is `-1` while the visitor is typing a new line and `0..n-1` while
 * they are walking back through submitted commands (`history` is newest-first,
 * so `0` is the previous command).
 *
 * Both navigators take the line currently in the input and return the line that
 * should replace it, or `undefined` to mean *leave it alone*. Returning
 * `undefined` rather than `""` is the whole fix: ArrowDown used to return `""`
 * at the bottom of the history and the caller assigned it unconditionally, so
 * pressing ArrowDown on a half-typed command erased it. ArrowDown is the
 * caret-to-end reflex in a terminal and the handler calls `preventDefault()`,
 * so there was no native behaviour left to fall back on and no undo.
 *
 * The draft is stashed on the first step up and handed back on the step down
 * that returns to the bottom, so ArrowUp/ArrowDown is a round trip rather than
 * a way to lose what you were writing.
 *
 * The cursor and the draft live in refs, not state: they are read back inside
 * the same keydown that writes them, and the previous version reached for them
 * by dispatching a `setHistory` updater purely to peek at the value it was
 * handed. That only returned anything because React evaluates an updater
 * eagerly when the fiber has no work pending — with an update already queued it
 * defers to render, and the navigator would have returned `undefined` while the
 * index still advanced, silently skipping an entry on the next press.
 */
export function useTerminalHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const cursor = useRef(-1);
  const draft = useRef("");

  const push = useCallback((cmd: string) => {
    if (cmd.trim()) {
      setHistory((prev) => [cmd, ...prev]);
    }
    // A submitted line ends the walk: the next ArrowUp starts from the top
    // again, and the stashed draft must not resurface under the new command.
    cursor.current = -1;
    draft.current = "";
  }, []);

  const navigateUp = useCallback(
    (current: string): string | undefined => {
      const next = cursor.current + 1;
      if (next > history.length - 1) return undefined;
      // Stash on the way out of the draft slot, not on every step.
      if (cursor.current === -1) draft.current = current;
      cursor.current = next;
      return history[next];
    },
    [history]
  );

  const navigateDown = useCallback((): string | undefined => {
    if (cursor.current === -1) return undefined;
    const next = cursor.current - 1;
    cursor.current = next;
    return next === -1 ? draft.current : history[next];
  }, [history]);

  return { history, push, navigateUp, navigateDown };
}
