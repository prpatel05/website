import { useEffect, useState } from "react";
import { ACTIVE_HEADING_MARK, activeHeadingId } from "@/lib/post-toc";

/**
 * Which H2 is current as the reader scrolls. Empty string on the first render
 * so the prerender and the hydrating client agree — the effect fills it in
 * after mount, which is also when the headings exist in the live document.
 */
export const useActiveHeading = (ids: string[]): string => {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    if (ids.length === 0) return;

    const update = () => {
      const headings = ids
        .map((id) => {
          const el = document.getElementById(id);
          return el ? { id, top: el.getBoundingClientRect().top } : null;
        })
        .filter((entry): entry is { id: string; top: number } => entry !== null);
      const next = activeHeadingId(headings, ACTIVE_HEADING_MARK);
      setActiveId((prev) => (prev === next ? prev : next));
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ids]);

  return activeId;
};
