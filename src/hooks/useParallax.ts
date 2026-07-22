import { useReducedMotion, useTransform, type MotionValue } from "framer-motion";

/**
 * A scroll-linked offset that switches itself off for `prefers-reduced-motion`.
 *
 * `MotionConfig reducedMotion="user"` only governs animations a motion
 * component runs. A value bound straight into `style` is not an animation —
 * it keeps tracking the scrollbar whatever the setting says, so the parallax
 * layers stayed in motion for exactly the people who asked them not to be.
 *
 * Returning `undefined` leaves the transform off the element entirely, which
 * is its resting position: the layer still renders, it just holds still.
 */
export function useParallax<T extends string | number>(
  progress: MotionValue<number>,
  input: number[],
  output: T[]
): MotionValue<T> | undefined {
  const offset = useTransform(progress, input, output);
  return useReducedMotion() ? undefined : offset;
}
