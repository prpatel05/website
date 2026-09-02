import { useEffect, useState, type RefObject } from "react";
import { readingProgress } from "@/lib/reading-progress";

type ReadingProgressProps = {
  target: RefObject<HTMLElement | null>;
  /** False while the body is still in flight, so we do not measure a skeleton. */
  enabled: boolean;
};

/**
 * Thin bar tracking how far the reader is through the article.
 *
 * Starts at 0 on both the prerender and the hydrating client so the first
 * paint cannot disagree. The width transition is `motion-safe`: a reader who
 * asked for reduced motion gets an instant jump, not a filling animation.
 * `print:hidden` because a meter that paints on every sheet is the same
 * defect the navbar already had.
 */
const ReadingProgress = ({ target, enabled }: ReadingProgressProps) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const update = () => {
      const el = target.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const next = readingProgress(top, el.offsetHeight, window.scrollY, window.innerHeight);
      setValue((prev) => (prev === next ? prev : next));
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [target, enabled]);

  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className="pointer-events-none fixed left-0 right-0 top-16 z-[60] h-0.5 print:hidden"
    >
      <div
        className="h-full bg-primary forced-colors:bg-[Highlight] motion-safe:transition-[width] motion-safe:duration-150"
        style={{ width: `${value}%` }}
      />
    </div>
  );
};

export default ReadingProgress;
