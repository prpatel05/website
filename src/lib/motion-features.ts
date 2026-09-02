import { domAnimation } from "framer-motion";

/**
 * The animation feature set, in its own module so `LazyMotion` can pull it in
 * with a dynamic import and Rollup has something to split on.
 *
 * `import("framer-motion")` directly from `App.tsx` would not work: the app
 * also imports `m`, `AnimatePresence` and `MotionConfig` from that package
 * statically, so the dynamic specifier resolves to a module the entry already
 * owns and Rollup emits no separate chunk. Naming a module that re-exports
 * only `domAnimation` gives the split a boundary to land on.
 */
export default domAnimation;
