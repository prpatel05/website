import { createContext, useContext } from "react";

export type CrtNoiseContextValue = {
  /** Overlay is painted. */
  enabled: boolean;
  /** Stored preference, ignoring reduced-motion. */
  storedOn: boolean;
  reduceMotion: boolean;
  toggle: () => void;
};

export const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

export function readReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(REDUCE_QUERY).matches;
}

export const CrtNoiseContext = createContext<CrtNoiseContextValue | null>(null);

export function useCrtNoise(): CrtNoiseContextValue {
  const ctx = useContext(CrtNoiseContext);
  if (!ctx) {
    throw new Error("useCrtNoise must be used within CrtNoiseProvider");
  }
  return ctx;
}
