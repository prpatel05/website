import { useEffect, useRef, useState } from "react";

/** The public Cal.com event this page books. No API key: it is a share link. */
export const CAL_LINK = "prpatel05/30min";
export const CAL_URL = `https://cal.com/${CAL_LINK}`;
/** Where `@calcom/embed-react` loads Cal's embed script from (its default). */
export const CAL_EMBED_SCRIPT = "https://app.cal.com/embed/embed.js";
const CAL_NAMESPACE = "30min";

/** `--primary` (hsl 160 100% 50%) as hex, for Cal's brand color. */
const BRAND = "#00ffaa";

/**
 * How long to wait for Cal's `linkReady` before pointing at the plain link.
 * The embed keeps loading behind the notice and replaces it if it lands.
 */
export const SLOW_AFTER_MS = 12000;

export type CalState = "idle" | "loading" | "slow" | "ready" | "failed";

/**
 * Shown over the embed's frame until Cal reports ready. `idle` is what the
 * prerendered HTML carries, so it is also the whole page for a reader with
 * JavaScript off: worded to be true either way. The lines are kept about the
 * same length on purpose, so the page does not jump as the state moves on
 * (e2e/hydration.spec.ts treats a shrinking page as a rebuilt one).
 */
const STATUS_COPY: Record<Exclude<CalState, "ready">, string> = {
  idle: "The calendar opens here. You can also book on cal.com directly.",
  loading: "Loading the calendar. You can also book on cal.com directly.",
  slow: "Still loading. You can also book on cal.com directly.",
  failed: "The calendar did not load here. You can book on cal.com directly.",
};

/**
 * Once the script has errored on this page load, `window.Cal` is a queue that
 * nothing will ever drain. Remembered so a second visit to /book/ in the same
 * tab goes straight to the fallback instead of waiting out the timer.
 */
let scriptFailed = false;

/**
 * Cal.com's inline embed, loaded only when this component mounts.
 *
 * Nothing Cal-related is in the entry chunk: `@calcom/embed-react` is a
 * dynamic import, and its loader is what appends embed.js to <head>. So the
 * third-party script only ever runs on /book/.
 *
 * Skipped during prerender. scripts/prerender.mjs snapshots the live DOM, and
 * a baked-in Cal iframe would hydrate against markup React never rendered.
 * The prerendered page therefore ships the idle state: a note and the plain
 * cal.com link, which is also exactly what a reader with JS off gets.
 *
 * The container Cal writes its iframe into has no React children, so React
 * never reconciles against Cal's DOM. Status copy lives in a sibling overlay.
 */
const CalEmbed = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<CalState>("idle");

  useEffect(() => {
    if (window.__PRERENDER__) return;
    const el = containerRef.current;
    if (!el) return;
    if (scriptFailed) {
      setState("failed");
      return;
    }

    let active = true;
    const settle = (next: CalState) => {
      if (active) setState(next);
    };
    setState("loading");
    const slowTimer = window.setTimeout(
      () => setState((s) => (active && s === "loading" ? "slow" : s)),
      SLOW_AFTER_MS
    );
    const fail = () => {
      scriptFailed = true;
      settle("failed");
    };

    import("@calcom/embed-react")
      .then(async ({ getCalApi }) => {
        const cal = await getCalApi({ namespace: CAL_NAMESPACE });
        if (!active) return;
        // The loader appends the script synchronously on first use, so it is
        // already in <head> here. A blocked or offline request only shows up
        // as this element's error event; Cal itself never reports it.
        const script = document.querySelector<HTMLScriptElement>(
          `script[src="${CAL_EMBED_SCRIPT}"]`
        );
        script?.addEventListener("error", fail, { once: true });

        cal("on", { action: "linkReady", callback: () => settle("ready") });
        cal("on", { action: "linkFailed", callback: fail });
        cal("ui", {
          theme: "dark",
          hideEventTypeDetails: false,
          layout: "month_view",
          cssVarsPerTheme: {
            dark: { "cal-brand": BRAND },
            light: { "cal-brand": BRAND },
          },
        });
        cal("inline", {
          elementOrSelector: el,
          calLink: CAL_LINK,
          config: { layout: "month_view", theme: "dark" },
        });
      })
      // The chunk itself failed (offline, or a deploy replaced its hash).
      .catch(fail);

    return () => {
      active = false;
      window.clearTimeout(slowTimer);
    };
  }, []);

  const busy = state === "loading" || state === "slow";

  return (
    <div data-cal-state={state} className="relative min-h-[34rem] sm:min-h-[44rem]">
      <div
        ref={containerRef}
        data-testid="cal-inline"
        className={`w-full overflow-auto ${state === "failed" ? "hidden" : ""}`}
        style={{ minHeight: "inherit" }}
      />
      {state !== "ready" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center pointer-events-none">
          <p
            className="font-mono text-sm text-foreground max-w-sm leading-relaxed"
            role={state === "failed" ? "alert" : "status"}
            aria-live="polite"
            aria-busy={busy}
          >
            {busy ? (
              <span
                aria-hidden="true"
                className="inline-block mr-2 h-2 w-2 rounded-full bg-primary motion-safe:animate-pulse"
              />
            ) : null}
            {STATUS_COPY[state]}
          </p>
          <a
            href={CAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto inline-flex items-center min-h-10 px-4 border border-primary/50 font-mono text-sm text-primary hover:bg-primary/10 transition-colors"
          >
            Open cal.com/{CAL_LINK}
          </a>
        </div>
      ) : null}
    </div>
  );
};

export default CalEmbed;
