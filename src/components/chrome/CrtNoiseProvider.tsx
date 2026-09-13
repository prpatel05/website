import { useMemo, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  CrtNoiseContext,
  readReducedMotion,
  REDUCE_QUERY,
  type CrtNoiseContextValue,
} from "@/hooks/useCrtNoise";
import { CRT_NOISE_KEY, readFlag, writeFlag } from "@/lib/site-preferences";

/**
 * Optional CRT noise/scanline overlay preference provider.
 *
 * Off by default. `prefers-reduced-motion` forces the overlay off regardless of
 * the stored flag. Initial state is always `false` so SSR/prerender and the
 * client's first paint agree.
 */
export function CrtNoiseProvider({ children }: { children: ReactNode }) {
  const [storedOn, setStoredOn] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setStoredOn(readFlag(CRT_NOISE_KEY));
    setReduceMotion(readReducedMotion());
    const mq = window.matchMedia?.(REDUCE_QUERY);
    if (!mq) return;
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    setStoredOn((prev) => {
      const next = !prev;
      writeFlag(CRT_NOISE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<CrtNoiseContextValue>(
    () => ({
      enabled: storedOn && !reduceMotion,
      storedOn,
      reduceMotion,
      toggle,
    }),
    [storedOn, reduceMotion, toggle]
  );

  return (
    <CrtNoiseContext.Provider value={value}>{children}</CrtNoiseContext.Provider>
  );
}
