import { useCrtNoise } from "@/hooks/useCrtNoise";

/**
 * Full-viewport CRT noise + scanline overlay.
 *
 * Mounted sitewide from PageShell but inert unless the chrome toggle turns it
 * on. CSS-only (no images, no canvas) so it cannot contend for LCP. Pointer
 * events stay off; print and reduced-motion keep it hidden via CSS + the hook.
 */
const CrtNoise = () => {
  const { enabled } = useCrtNoise();

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      className="crt-noise pointer-events-none fixed inset-0 z-[60] print:hidden"
    />
  );
};

export default CrtNoise;
