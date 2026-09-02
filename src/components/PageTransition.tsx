import { ReactNode } from "react";
import { m } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useEntrance } from "@/hooks/useEntrance";

/**
 * No `filter` here, and it is not a matter of taste.
 *
 * These variants used to blur in from `blur(8px)` to `blur(0px)`, and framer
 * leaves the final value in the inline style — `filter: blur(0px)`, forever. Any
 * `filter` other than `none` makes the element a **containing block for
 * `position: fixed` descendants**, and `Index.tsx` renders both the navbar and
 * the terminal inside this wrapper. So nothing on the page was really fixed:
 *
 * | element                            | scrollY 0  | scrollY 1000 |
 * | ---------------------------------- | ---------- | ------------ |
 * | `nav` (`fixed top-0`)              | `top=0`    | `top=-1000`  |
 * | terminal toggle (`fixed bottom-6`) | `top=3760` | `top=2760`   |
 *
 * The sticky nav scrolled away on every route, the floating terminal toggle sat
 * ~3760px down the document where nobody would find it, and the mobile menu's
 * `fixed inset-0` overlay measured 375x4779 with its links at y=2273 — a blurred
 * backdrop with nothing on it. `toBeVisible()` is happy with all of that, which
 * is why no spec objected; `e2e/fixed-chrome.spec.ts` measures against the
 * viewport instead.
 *
 * `y` still animates, so `transform` makes this a containing block for the 0.5s
 * the entrance runs. That is transient, and a route entry starts at scroll 0
 * where the difference is nothing — but it is the reason to keep an eye on
 * anything added here: `filter`, `transform`, `perspective`, `backdrop-filter`,
 * `contain` and `will-change` all do it, and the blur was the one that stayed.
 */
const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

const PageTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const entrance = useEntrance();

  return (
    <m.div
      key={location.pathname}
      variants={pageVariants}
      initial={entrance("initial")}
      animate="animate"
      exit="exit"
    >
      {children}
    </m.div>
  );
};

export default PageTransition;
