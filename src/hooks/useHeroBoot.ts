import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { HERO_BOOT_SEEN_KEY, readFlag, writeFlag } from "@/lib/site-preferences";

export type HeroBootState =
  | { ready: false }
  | { ready: true; play: boolean };

/**
 * First-visit hero boot gate.
 *
 * - First visit: play the typing / boot animation once, then remember.
 * - Later visits: settle immediately (no typing cycle).
 * - `prefers-reduced-motion`: always settle; still mark seen so a later
 *   preference flip does not surprise-replay the boot.
 *
 * `ready: false` until the client has checked storage, so the typing effect
 * does not start a frame of animation that the preference then cancels.
 */
export function useHeroBoot(): HeroBootState {
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<HeroBootState>({ ready: false });

  useEffect(() => {
    const seen = readFlag(HERO_BOOT_SEEN_KEY);
    const play = !reduceMotion && !seen;
    // Mark seen as soon as a boot is allowed to start, so a refresh mid-type
    // lands in the settled state rather than replaying half an animation.
    if (!seen) writeFlag(HERO_BOOT_SEEN_KEY, true);
    setState({ ready: true, play });
  }, [reduceMotion]);

  return state;
}
