import { useRef } from "react";
import { useScroll, useTransform, type MotionValue } from "framer-motion";

interface ScrollAnimationOptions {
  offsetStart?: string;
  offsetEnd?: string;
  opacityRange?: [number, number];
}

interface ScrollAnimationResult {
  ref: React.RefObject<HTMLElement | null>;
  scrollYProgress: MotionValue<number>;
  sectionOpacity: MotionValue<number>;
}

export function useScrollAnimation(options: ScrollAnimationOptions = {}): ScrollAnimationResult {
  const {
    offsetStart = "start end",
    offsetEnd = "end start",
    opacityRange = [0, 0.15],
  } = options;

  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: [offsetStart, offsetEnd],
  });

  const sectionOpacity = useTransform(scrollYProgress, opacityRange, [0, 1]);

  return { ref, scrollYProgress, sectionOpacity };
}
