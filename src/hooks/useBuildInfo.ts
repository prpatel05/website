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

const short = (value: string) => value.trim().slice(0, 7);

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

/**
 * Status-bar inputs. SHA prefers `/build-sha.txt` (written by CI after build);
 * falls back to a shortened build-stamp id when the file is absent (local
 * preview). Fetch is fire-and-forget so first paint is never blocked.
 */
export const useBuildInfo = (): BuildInfo => {
  const [info, setInfo] = useState<BuildInfo>(EMPTY);

  useEffect(() => {
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
        if (text.trim()) shortSha = short(text);
      }

      if (stampRes?.ok) {
        const stamp = (await stampRes.json().catch(() => null)) as {
          id?: string;
          builtAt?: string;
        } | null;
        if (!shortSha && typeof stamp?.id === "string") {
          shortSha = short(stamp.id);
        }
        if (typeof stamp?.builtAt === "string") {
          deployed = formatDeployed(stamp.builtAt);
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
