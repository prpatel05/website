import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useFirstLoad } from "@/hooks/useEntrance";
import { normalizeArchiveTag } from "@/lib/blog-tags";

/**
 * The `?tag=` filter for `/blog/`.
 *
 * GitHub Pages serves the prerendered `/blog/index.html` for every query
 * string, so a first paint that hid cards would hydrate against markup that
 * still has them. Client-side navigation is a fresh mount and can filter
 * immediately.
 */
export const useArchiveTag = (): string | null => {
  const [searchParams] = useSearchParams();
  const requested = normalizeArchiveTag(searchParams.get("tag"));
  const firstLoad = useFirstLoad();
  const [ready, setReady] = useState(!firstLoad);

  useEffect(() => {
    setReady(true);
  }, []);

  return ready ? requested : null;
};
