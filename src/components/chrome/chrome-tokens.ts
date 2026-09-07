/**
 * Shared mono chrome tokens so SiteTopBar / jump rail / footer / status /
 * section labels read as one product instead of four independently styled strips.
 * Keep sizes aligned with post chrome (`// contents`, `// all posts`).
 */
export const chromeSep = "text-border";

/** `// section` / jump-rail voice — matches PostToc + SectionHeader. */
export const chromeLabel =
  "font-mono text-xs tracking-widest text-primary/60 print:text-primary";

/** Path crumbs in the top bar. */
export const chromePath = "font-mono text-xs tracking-wide";

/** Footer + status meta line. */
export const chromeMeta = "font-mono text-[10px] tracking-widest text-muted-foreground";

/** Sitemap / jump / CRT interactive chrome. */
export const chromeLink =
  "inline-flex items-center justify-center min-h-6 min-w-6 px-1.5 text-muted-foreground hover:text-primary transition-colors";

/** Active jump / CRT-on / status SHA accent — related primary family. */
export const chromeAccent = "text-primary";
export const chromeAccentSoft = "text-primary/70 print:text-primary";
