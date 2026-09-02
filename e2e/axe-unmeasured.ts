import type { Result } from "axe-core";

/**
 * The text axe declined to judge the contrast of.
 *
 * axe sorts results into `violations`, `passes`, `inapplicable` — and
 * `incomplete`, "needs review", which is where a `color-contrast` check lands
 * when the engine cannot resolve what the text sits on: a gradient backdrop, or
 * an element overlapping the node. Nothing on this site read that list until
 * PRA-1023, so `/` — every node of it, hero `h1` through footer — was excused
 * from the contrast gate while reporting green.
 *
 * Two callers share this so they cannot drift apart: `a11y-axe.spec.ts` asserts
 * the list is empty on every flat route, and `gradient-contrast.spec.ts` takes
 * it as the exact worklist to measure by pixel on `/`.
 *
 * Decorative nodes are dropped for the reason axe itself gives — "content
 * contains only non-text characters". Those are the bullet spans, the sub-pixel
 * `|` separators and the `/>` watermark: 234 of the 278 nodes a full-site sweep
 * returns, none carrying information, and requiring real copy is what keeps the
 * list to text a reader is meant to read.
 */
export const DECORATIVE = "non-text characters";

export function unmeasuredContrastNodes(incomplete: Result[]): string[] {
  return incomplete
    .filter((result) => result.id === "color-contrast")
    .flatMap((result) => result.nodes)
    .filter((node) =>
      [...(node.any ?? []), ...(node.all ?? []), ...(node.none ?? [])].every(
        (check) => !(check.message ?? "").includes(DECORATIVE)
      )
    )
    .map((node) => node.target.join(" "));
}
