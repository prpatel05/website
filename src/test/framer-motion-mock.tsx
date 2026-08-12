import { forwardRef, type ReactNode, type Ref } from "react";

/**
 * The `m.*` proxy the jsdom suites mock `framer-motion` with, in one place.
 *
 * It lived inline in each test file, which is how six copies of it came to
 * differ in the two ways that decide whether a test means anything:
 *
 * 1. **`forwardRef`.** Every copy built its component with a plain function,
 *    and on React 18 that silently drops `ref` — no warning, nothing to notice.
 *    `<m.div ref={dialogRef}>` then left `dialogRef.current` null and
 *    `useFocusTrap` returned on its first line, so the mocked overlay had no
 *    focus trap at all. That is not a cosmetic gap: it is how "closes terminal
 *    on Escape" went on passing after Escape moved into the trap (PRA-912),
 *    against a component that no longer had one.
 * 2. **The prop allowlist.** Each copy allowed through whatever its own
 *    assertions happened to read, so anything else reached jsdom as nothing at
 *    all. `role` and `aria-*` are the ones that bite: `role="dialog"` is how
 *    `@/lib/overlay-stack` recognises an overlay on its way out, and
 *    `aria-modal`/`aria-label` are most of what an overlay test would want to
 *    assert about.
 *
 * Framer's own props (`initial`, `animate`, `exit`, `transition`, `variants`,
 * …) are deliberately *not* passed through — React would warn on every one of
 * them — which is why this stays an allowlist rather than a spread.
 */

/** Props that are real DOM attributes on the elements the site animates. */
const PASSTHROUGH = new Set([
  "className",
  "style",
  "id",
  "title",
  "role",
  "tabIndex",
  "href",
  "target",
  "rel",
  "type",
  "disabled",
  "placeholder",
  "value",
  "dangerouslySetInnerHTML",
]);

const isDomProp = (key: string) =>
  PASSTHROUGH.has(key) ||
  key.startsWith("on") ||
  key.startsWith("aria-") ||
  key.startsWith("data-");

/**
 * Builds the mock module's exports. Call it from inside the `vi.mock` factory —
 * the factory is hoisted above imports, so it has to be reached with a dynamic
 * import:
 *
 * ```ts
 * vi.mock("framer-motion", async () => {
 *   const { createFramerMotionMock } = await import("@/test/framer-motion-mock");
 *   return createFramerMotionMock();
 * });
 * ```
 *
 * Spread the result to add whatever else a given suite pulls off the module
 * (`useScroll`, `useReducedMotion`, …).
 */
export const createFramerMotionMock = () => {
  // Cached per tag. The proxy is read on every render, and handing React a
  // fresh component identity each time remounts the subtree — which for an
  // overlay means re-running the trap's open/restore cycle on every state
  // change, and losing whatever the reader had focused.
  const tags = new Map<string, ReturnType<typeof forwardRef>>();

  const m = new Proxy(
    {},
    {
      get: (_target, prop) => {
        const name = typeof prop === "string" ? prop : "div";
        if (!tags.has(name)) {
          tags.set(
            name,
            forwardRef<HTMLElement, Record<string, unknown>>(
              ({ children, ...props }, ref) => {
                const htmlProps: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(props)) {
                  if (isDomProp(k)) htmlProps[k] = v;
                }
                const Tag = name as "div";
                return (
                  <Tag
                    ref={ref as Ref<HTMLDivElement>}
                    data-testid={`motion-${name}`}
                    {...htmlProps}
                  >
                    {children as ReactNode}
                  </Tag>
                );
              }
            )
          );
        }
        return tags.get(name);
      },
    }
  );

  return {
    m,
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
};
