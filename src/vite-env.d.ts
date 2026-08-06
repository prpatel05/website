/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cloudflare Web Analytics site token (public). Injected at build time; unset = beacon disabled. See PRA-465. */
  readonly VITE_CF_BEACON_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /**
   * The pre-hydration Ctrl+K stand-in defined inline in `index.html`. Present
   * from parse time until React claims it; `undefined` afterwards.
   */
  __terminalBoot?: {
    /**
     * Retires the stand-in and reports whether a Ctrl+K landed before React was
     * live. Call once, from the terminal's mount effect.
     */
    claim(): boolean;
  };
}
