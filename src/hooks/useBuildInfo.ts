import { useEffect, useState } from "react";
import { posts } from "@/data/blog-posts/registry";

export type BuildInfo = {
  /** Short SHA (7 chars) once known; empty until the fetch settles. */
  shortSha: string;
  /** Deploy / build timestamp for display, or empty. */
  deployed: string;
  /** Newest post title (and slug fallback). Known synchronously from the registry. */
  newestTitle: string;
  newestSlug: string;
};

const EMPTY: BuildInfo = {
  shortSha: "",
  deployed: "",
  newestTitle: posts[0]?.title ?? "",
  newestSlug: posts[0]?.slug ?? "",
};

/**
 * Accept a git SHA or a UUID-like stamp id; reject SPA HTML fallbacks and
 * other junk. The prerender static server (and vite preview) answer missing
 * files with the app shell at 200, so an unchecked `res.ok` once baked
 * `<!DOCTYPE…` into the status bar and blew hydration.
 */
export const parseShaCandidate = (raw: string): string => {
  const text = raw.trim();
  if (!text || text.startsWith("<")) return "";
  const hex = text.replace(/-/g, "");
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 7) return "";
  return hex.slice(0, 7).toLowerCase();
};

const formatDeployed = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Fixed locale so prerender and client agree on the string shape.
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

declare global {
  interface Window {
    /** Set only by `scripts/prerender.mjs` so status fetches stay off the snapshot. */
    __PRERENDER__?: boolean;
  }
}

/**
 * Status-bar inputs. SHA prefers `/build-sha.txt` (written by CI after build);
 * falls back to a shortened build-stamp id when the file is absent (local
 * preview). Fetch is fire-and-forget so first paint is never blocked.
 *
 * Skipped while `window.__PRERENDER__` is set: the prerenderer waits for
 * network idle and would otherwise capture the post-fetch DOM (`main @ local`
 * or worse), which cannot hydrate against the client's first paint (`main @ …`).
 */
export const useBuildInfo = (): BuildInfo => {
  const [info, setInfo] = useState<BuildInfo>(EMPTY);

  useEffect(() => {
    if (typeof window !== "undefined" && window.__PRERENDER__) return;

    let cancelled = false;
    const base = import.meta.env.BASE_URL || "/";

    const load = async () => {
      const [shaRes, stampRes] = await Promise.all([
        fetch(`${base}build-sha.txt`).catch(() => null),
        fetch(`${base}build-stamp.json`).catch(() => null),
      ]);

      let shortSha = "";
      let deployed = "";

      if (shaRes?.ok) {
        const text = await shaRes.text().catch(() => "");
        shortSha = parseShaCandidate(text);
      }

      if (stampRes?.ok) {
        const raw = await stampRes.text().catch(() => "");
        // Same SPA-fallback trap as the .txt: a 200 HTML body is not JSON.
        if (raw && !raw.trimStart().startsWith("<")) {
          const stamp = (() => {
            try {
              return JSON.parse(raw) as { id?: string; builtAt?: string };
            } catch {
              return null;
            }
          })();
          if (!shortSha && typeof stamp?.id === "string") {
            shortSha = parseShaCandidate(stamp.id);
          }
          if (typeof stamp?.builtAt === "string") {
            deployed = formatDeployed(stamp.builtAt);
          }
        }
      }

      if (cancelled) return;
      setInfo((prev) => ({
        ...prev,
        shortSha: shortSha || "local",
        deployed,
      }));
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return info;
};
