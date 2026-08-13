import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock framer-motion before importing the component
vi.mock("framer-motion", () => {
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, prop) => {
        return ({ children, ...props }: Record<string, unknown>) => {
          const htmlProps: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(props)) {
            if (k === "className" || k === "style" || k === "ref" || k === "id") {
              htmlProps[k] = v;
            }
          }
          const tag = typeof prop === "string" ? prop : "div";
          if (tag === "section") {
            return <section {...htmlProps}>{children}</section>;
          }
          return <div {...htmlProps}>{children}</div>;
        };
      },
    }
  );
  return {
    m: motionProxy,
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useTransform: (_: unknown, __: unknown, defaults: unknown[]) => defaults?.[0] ?? 0,
    useReducedMotion: () => false,
    // `useParallaxFade` builds its pointer-events gate with the standalone
    // `transform()` rather than the hook, so this mock has to carry it or Hero
    // throws on render. A clamped linear interpolator — what the real one is
    // for the numeric two-stop ranges this component passes it.
    transform: (input: number[], output: number[]) => (value: number) => {
      const inMin = input[0];
      const inMax = input[input.length - 1];
      const outMin = output[0];
      const outMax = output[output.length - 1];
      const t = Math.min(Math.max((value - inMin) / (inMax - inMin), 0), 1);
      return outMin + t * (outMax - outMin);
    },
  };
});

import { MemoryRouter } from "react-router-dom";
import Hero from "../Hero";

// Hero reads the router location to decide whether to play its entrance
// animation, so it only renders under a Router.
const renderHero = () =>
  render(
    <MemoryRouter>
      <Hero />
    </MemoryRouter>
  );
import {
  PORTRAIT_SIZES,
  PORTRAIT_SRC,
  PORTRAIT_SRCSET,
} from "@/lib/portrait";

const ROLES = [
  "CTO & Chief Architect",
  "AI · Cloud · Web3",
  "3x Company Builder",
  "Startup Co-Founder (Acquired)",
];

/** Advance fake timers one tick at a time so each setTimeout → state update → re-render → next setTimeout chain works. */
function advanceTicks(count: number, intervalMs: number) {
  for (let i = 0; i < count; i++) {
    act(() => {
      vi.advanceTimersByTime(intervalMs);
    });
  }
}

describe("Hero – typing effect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts typing the first role character by character", () => {
    renderHero();

    const role = ROLES[0]; // "CTO & Chief Architect"

    // Advance 5 characters (80ms each, one tick at a time)
    advanceTicks(5, 80);

    expect(screen.getByText(role.slice(0, 5))).toBeInTheDocument();
  });

  it("fully types the first role then pauses", () => {
    renderHero();

    const role = ROLES[0];

    // Type all chars one at a time
    advanceTicks(role.length, 80);

    expect(screen.getByText(role)).toBeInTheDocument();

    // During pause, text stays
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(role)).toBeInTheDocument();
  });

  it("deletes the role after the pause", () => {
    renderHero();

    const role = ROLES[0];

    // Type the full role
    advanceTicks(role.length, 80);

    // Trigger the 2000ms pause → sets isDeleting=true
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Delete 5 characters (40ms each)
    advanceTicks(5, 40);

    const shortened = role.slice(0, role.length - 5);
    expect(screen.getByText(shortened)).toBeInTheDocument();
  });

  it("cycles to the next role after full delete", () => {
    renderHero();

    const role1 = ROLES[0];

    // Type first role
    advanceTicks(role1.length, 80);
    // Pause
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // Delete all chars
    advanceTicks(role1.length, 40);

    // Now typing the second role — advance enough chars to get identifiable text
    advanceTicks(10, 80);

    // Query displayText span directly (avoids RTL whitespace normalization issues)
    expect(screen.getByText(ROLES[1].slice(0, 10))).toBeInTheDocument();
  });

  it("wraps around to the first role after all roles cycle", () => {
    renderHero();

    // Cycle through all 4 roles
    for (const role of ROLES) {
      advanceTicks(role.length, 80); // type
      act(() => {
        vi.advanceTimersByTime(2000);
      }); // pause
      advanceTicks(role.length, 40); // delete
    }

    // Should start typing the first role again
    advanceTicks(5, 80);
    expect(screen.getByText(ROLES[0].slice(0, 5))).toBeInTheDocument();
  });
});

describe("Hero – static content", () => {
  it("renders the name", () => {
    renderHero();
    expect(screen.getByText("Pratik")).toBeInTheDocument();
    expect(screen.getByText("Patel")).toBeInTheDocument();
  });

  it("renders the bio paragraph", () => {
    renderHero();
    expect(
      screen.getByText(/Technology executive and hands-on architect/i)
    ).toBeInTheDocument();
  });

  it("renders CTA links", () => {
    renderHero();
    expect(screen.getByText("./contact --init")).toBeInTheDocument();
    expect(screen.getByText("cat resume.pdf")).toBeInTheDocument();
  });
});

describe("Hero – portrait", () => {
  // The wrapper is `hidden md:block`, which does not cancel the fetch, so a
  // phone downloads whatever this points at. Pointing it back at the 341KB
  // PNG master would be invisible on screen and expensive on the wire.
  it("loads the generated variants, not the PNG master", () => {
    renderHero();
    const portrait = screen.getByAltText("Pratik Patel");

    expect(portrait.getAttribute("src")).toBe(PORTRAIT_SRC);
    expect(portrait.getAttribute("srcset")).toBe(PORTRAIT_SRCSET);
    expect(portrait.getAttribute("sizes")).toBe(PORTRAIT_SIZES);
    expect(portrait.getAttribute("src")).not.toContain(".png");
  });

  // Without both, the box has no aspect ratio until the bytes arrive and the
  // rest of the hero shifts under it.
  it("reserves the box", () => {
    renderHero();
    const portrait = screen.getByAltText("Pratik Patel");

    expect(portrait.getAttribute("width")).toBe("288");
    expect(portrait.getAttribute("height")).toBe("288");
  });
});

describe("Hero – the role line as a screen reader gets it", () => {
  /**
   * The line read as "dollar sign, CTO & Chief Architect, left five eighths
   * block": neither piece of shell decoration was hidden. The convention was
   * already the repo's own — InteractiveTerminal hides the identical `$`
   * prompt, and the archive, preview and post page all hide their `|`
   * separators — the hero was just the one place it was missed.
   *
   * Asserted as "no bare glyph is exposed" rather than by naming the two spans,
   * so a third decorative character added later is caught too.
   */
  it("keeps the prompt and cursor glyphs out of the accessibility tree", () => {
    const { container } = renderHero();

    const exposed = Array.from(container.querySelectorAll("span"))
      .filter((el) => el.children.length === 0)
      .filter((el) => /[▊$]/.test(el.textContent ?? ""))
      .filter((el) => !el.closest("[aria-hidden='true']"))
      .map((el) => el.textContent);

    expect(exposed).toEqual([]);
  });

  // Positive control: the spans are actually there to be hidden. Without this,
  // deleting the whole line would pass the assertion above.
  it("still paints both glyphs", () => {
    const { container } = renderHero();

    const glyphs = Array.from(container.querySelectorAll("[aria-hidden='true']"))
      .map((el) => el.textContent?.trim())
      .filter((t) => t === "$" || t === "▊");

    expect(glyphs).toHaveLength(2);
  });
});
