import { useState, useRef, useEffect, useCallback } from "react";
import { m, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Terminal, X } from "lucide-react";
import { processTerminalCommand, type TerminalLine } from "@/lib/terminal-commands";
import { useTerminalHistory } from "@/hooks/useTerminalHistory";
import { useEntrance, useOverlayEntrance } from "@/hooks/useEntrance";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useScrollLock } from "@/hooks/useScrollLock";
import { scrollBehavior } from "@/lib/scroll-behavior";

const InteractiveTerminal = () => {
  const entrance = useEntrance();
  const overlayEntrance = useOverlayEntrance();
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const lastScroller = useRef<HTMLDivElement | null>(null);
  const pendingRef = useRef<number>();
  const navigate = useNavigate();

  // Opening lands on the command line rather than the close button — the input
  // is the whole point of the overlay. Ctrl+K from anywhere in the page means
  // the trap has to hand focus back to wherever it came from, falling back to
  // the toggle button for the common case where that was the toggle itself
  // (which unmounts while the terminal is open, so the old node is long gone).
  //
  // Escape goes through the trap rather than the shortcut handler below, so
  // that only the overlay on top answers it: Ctrl+K opens this on top of the
  // mobile menu, and two independent Escape handlers closed both at once and
  // stranded the keyboard on a node that was already leaving (PRA-912).
  useFocusTrap(dialogRef, open, {
    initialFocus: inputRef,
    fallbackFocus: toggleRef,
    onEscape: () => setOpen(false),
  });
  useScrollLock(open);

  // Keep the newest line in view. `open` is a dependency, not just `lines`,
  // because the scroller unmounts with the dialog: reopening mounts a fresh one
  // at `scrollTop = 0` while `lines` is referentially unchanged, so on `[lines]`
  // alone the effect never re-ran and the reader came back to the top of the
  // scrollback instead of the prompt they left at. Measured on `main`: two
  // commands, Escape, reopen — `scrollTop` 149 -> 0 with 231px of overflow and
  // the welcome banner back at the top (PRA-921).
  //
  // A freshly mounted scroller jumps; only an append animates. Smooth-scrolling
  // 231px on reopen would show the reader that stale top for the length of the
  // scroll, which is the thing being fixed. Fresh is decided by node identity
  // rather than by a "have we run yet" flag: `AnimatePresence` keeps the
  // outgoing dialog mounted for its 300ms exit, so the ref still holds the old
  // node when this runs on close and a flag would come back set.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const fresh = lastScroller.current !== el;
    lastScroller.current = el;
    el.scrollTo({ top: el.scrollHeight, behavior: fresh ? "auto" : scrollBehavior() });
  }, [lines, open]);

  // A Ctrl+K that landed before this component could bind anything was caught
  // and held by the stand-in in index.html. Take it over: open if the visitor
  // already asked, and retire the stand-in either way, so the toggle below is
  // the only live handler. Mount-only — the stand-in answers once and then
  // removes itself, so a later mount finds nothing to claim.
  useEffect(() => {
    if (window.__terminalBoot?.claim()) setOpen(true);
  }, []);

  // Keyboard shortcut to toggle. Bound whether or not the terminal is open —
  // opening it is the whole point — unlike Escape, which is the focus trap's
  // and only fires while this overlay is the one on top.
  //
  // `e.key` is the character the key produces, so with Caps Lock on the browser
  // reports "K" and an `=== "k"` test simply stopped matching — the shortcut
  // this component advertises in the toggle's `title` and in `help` output was
  // dead for anyone typing in caps. Lowercased rather than switched to
  // `e.code === "KeyK"`, which would pin the shortcut to the physical QWERTY
  // position and move it under the reader's fingers on any other layout.
  // `!shiftKey` keeps the pre-existing behaviour exactly: Ctrl+Shift+K did not
  // open the terminal before and still does not, so the browser's own
  // console shortcut is left alone (PRA-921).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // The 300ms a deferred navigate/scroll waits for is the exit animation's own
  // duration, so the terminal is still on screen for every millisecond of it —
  // which makes reopening inside that window a thing a reader does, not a race.
  // Measured on `main`: `contact` then Ctrl+K scrolled the page 3062px
  // underneath the reopened overlay, and `blog` routed away and took the
  // terminal with it, since only the home route mounts one. Reopening cancels
  // whatever is still pending (PRA-921).
  const defer = useCallback((fn: () => void) => {
    window.clearTimeout(pendingRef.current);
    pendingRef.current = window.setTimeout(fn, 300);
  }, []);

  useEffect(() => {
    if (open) window.clearTimeout(pendingRef.current);
  }, [open]);

  // Separate from the cancel above, and mount-only on purpose: a cleanup on
  // `[open]` would also run as the terminal closes, which is precisely when the
  // timer has just been scheduled — it would cancel every navigation instead of
  // only the superseded ones.
  useEffect(() => () => window.clearTimeout(pendingRef.current), []);

  const scrollToSection = useCallback(
    (id: string) => {
      setOpen(false);
      defer(() => {
        const el = document.getElementById(id);
        // Not a hardcoded "smooth": this animates the whole document — 3112px
        // to `#contact` from the top — which is the large-area motion
        // `prefers-reduced-motion` exists to prevent. The nav's own `#contact`
        // link has always jumped, so before this the two paths to the same
        // section disagreed for that reader (PRA-941).
        el?.scrollIntoView({ behavior: scrollBehavior() });
      });
    },
    [defer]
  );

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
          defer(() => navigate(result.path));
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
    [defer, navigate, scrollToSection]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processCommand(input);
    push(input);
    setInput("");
  };

  // Both navigators return `undefined` for "there is nothing that way, leave
  // the line as it is". Assigning the return value unconditionally is what let
  // ArrowDown erase a half-typed command: `preventDefault` has already taken
  // away the caret-to-end the key would otherwise have done, so a wiped line
  // was neither recoverable nor explicable. The current line goes *in* so the
  // hook can stash it as the draft and hand it back on the way down.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const recalled = e.key === "ArrowUp" ? navigateUp(input) : navigateDown();
    if (recalled !== undefined) setInput(recalled);
  };

  return (
    <>
      {/* Toggle button.

          `print:hidden` because a `position: fixed` element paints on every
          printed sheet, not just the first — and this one is a control that
          opens a terminal, which paper cannot do. The navbar has the same
          problem and is retired in the `@media print` block in
          `src/index.css`; this one takes a variant instead, because the only
          selector that would reach it from CSS is its `title` string. It went
          unnoticed for a first pass because the route that prints — a blog
          post — does not render the terminal at all, so the assertion looking
          for it was pointed at a page it could not be on (PRA-1063). */}
      <AnimatePresence>
        {showButton && !open && (
          <m.button
            ref={toggleRef}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-card border border-border flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 group print:hidden"
            /*
              Through `entrance()` like every other first-paint animation on the
              site. This one was missed because the button is quick enough that
              the prerender always captured it already faded in — the HTML never
              carried the opacity:0, so the build's invisible-markup guard had
              nothing to catch. Hydration is what surfaces it: the client's
              first render wants opacity:0 over markup that is already visible,
              which both mismatches and blinks the button out and back.
            */
            initial={entrance({ opacity: 0, scale: 0.8, y: 20 })}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Open terminal (Ctrl+K)"
          >
            <Terminal className="w-5 h-5" />
          </m.button>
        )}
      </AnimatePresence>

      {/* Terminal overlay */}
      <AnimatePresence>
        {open && (
          <>
            <m.div
              initial={overlayEntrance({ opacity: 0 })}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-background/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <m.div
              ref={dialogRef}
              /*
                Through `overlayEntrance()` rather than `entrance()`: this
                overlay is never prerendered, so only the missing-features half
                of the suppression applies. Ungated it was not a race but a
                certainty — the pre-hydration Ctrl+K below opens the terminal on
                the first commit, ahead of the feature chunk, and the reader got
                a focused input inside an invisible dialog.
              */
              initial={overlayEntrance({ opacity: 0, y: 40, scale: 0.95 })}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label="Interactive terminal"
              className="fixed inset-x-2 sm:inset-x-4 bottom-2 sm:bottom-4 top-auto z-[201] max-w-2xl mx-auto sm:inset-x-auto sm:bottom-8 sm:w-full"
              /*
                Click anywhere in the terminal to get the caret back — except
                when that click is the end of a drag over the output. `click`
                fires on the common ancestor of mousedown and mouseup, so a
                selection made anywhere inside the dialog lands here, and
                focusing a text input collapses the document selection.
                Measured on `main`: dragging across `whoami`'s output selected
                the line and mouseup left `getSelection()` empty, so the email
                address the command prints could not be copied at all
                (PRA-921).
              */
              onClick={() => {
                if (window.getSelection()?.isCollapsed === false) return;
                inputRef.current?.focus();
              }}
            >
              <div className="border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[60vh] sm:max-h-[70vh]">
                {/* Title bar */}
                <div className="h-9 bg-muted border-b border-border flex items-center px-4 gap-2 shrink-0">
                  {/* Redundant mouse-only affordance mirroring the macOS traffic
                      light. The labelled X button beside it is the control
                      exposed to keyboard and assistive tech, so this one stays
                      out of the focus order rather than duplicating the name. */}
                  <button onClick={() => setOpen(false)} aria-hidden="true" tabIndex={-1} className="w-3 h-3 rounded-full bg-destructive/60 hover:bg-destructive transition-colors" />
                  <span aria-hidden="true" className="w-3 h-3 rounded-full bg-primary/40" />
                  <span aria-hidden="true" className="w-3 h-3 rounded-full bg-primary/60" />
                   <span className="font-mono text-[10px] text-muted-foreground ml-3 flex-1 text-center">
                     pratik.pa.tel — bash
                   </span>
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Close terminal"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>

                {/* Output */}
                <div
                  ref={scrollRef}
                  role="log"
                  aria-live="polite"
                  aria-label="Terminal output"
                  /*
                    A scroll container with no focusable descendant, so nothing
                    but this attribute puts it in the tab ring — and once the
                    scrollback outgrows the cap below, scrolling this box is the
                    only way to read what went off the top. ArrowUp cannot stand
                    in: the command line takes it for history.

                    Chromium hid this. It synthesises a tab stop for a scroller
                    with no focusable child, so there the div was already
                    reachable and PageUp already worked. WebKit has no such
                    behaviour — measured on WebKit 26.0, Tab never visited it,
                    `el.focus()` did not even stick, and no key moved
                    `scrollTop`, while the wheel moved it fine. So a Safari
                    keyboard reader who typed `help`, which the welcome banner
                    tells them to do, could not read the answer: the effect above
                    pins to the bottom, stranding 329px of banner and command
                    list with no way back (PRA-1034).

                    `useFocusTrap`'s FOCUSABLE already matches `[tabindex]`, so
                    this joins the trap in DOM order — close button, log, input.
                  */
                  tabIndex={0}
                  /*
                    The `min-h` floor gives the log a body when the scrollback is
                    short, and it is the only item here that may shrink — but a
                    `min-height` is a floor flexbox may not shrink past, and the
                    panel above is capped at `60vh`. A reader at 400% browser zoom
                    has a ~200px-tall viewport, so that cap was 120px around a
                    277px stack: 159px had nowhere to go, and `overflow-hidden`
                    meant no gesture could reach it. Opening the terminal focuses
                    this input, which scrolled the panel down to reveal it and put
                    the title bar — and the labelled close button in it — out of
                    view for good. Keyboard readers were fine, because focus
                    scrolls a clipped node back in; touch readers had no way.
                    Measured on `main` at 320x200: 159px clipped, the close button
                    at `top: -75`, and a wheel over the panel left `scrollTop`
                    unmoved (PRA-960).

                    So the floor only applies where the cap can afford it: the
                    stack needs `60vh >= 277px`, i.e. a viewport taller than
                    ~462px. Below that the floor drops and the log yields instead,
                    keeping the chrome on screen with the scrollback still
                    reachable through this scroller. Gated on height rather than
                    swapped for a shrinkable `flex-basis`, which would have pinned
                    the log to exactly 200px at every size — `flex-1`'s `0%` basis
                    is indefinite against this panel, so today the log grows to its
                    content up to the cap, and a definite basis would have started
                    scrolling output that used to simply fit.
                  */
                  className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed min-h-[200px] [@media(max-height:30rem)]:min-h-0"
                >
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
                  <span aria-hidden="true" className="text-primary font-mono text-xs">$</span>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    aria-label="Terminal command"
                    className="flex-1 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/80 caret-primary"
                    placeholder='type "help" to get started...'
                    autoComplete="off"
                    spellCheck={false}
                  />
                </form>
              </div>
            </m.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default InteractiveTerminal;
