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
    motion: motionProxy,
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useTransform: (_: unknown, __: unknown, defaults: unknown[]) => defaults?.[0] ?? 0,
  };
});

import Hero from "../Hero";

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
    render(<Hero />);

    const role = ROLES[0]; // "CTO & Chief Architect"

    // Advance 5 characters (80ms each, one tick at a time)
    advanceTicks(5, 80);

    expect(screen.getByText(role.slice(0, 5))).toBeInTheDocument();
  });

  it("fully types the first role then pauses", () => {
    render(<Hero />);

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
    render(<Hero />);

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
    render(<Hero />);

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
    render(<Hero />);

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
    render(<Hero />);
    expect(screen.getByText("Pratik")).toBeInTheDocument();
    expect(screen.getByText("Patel")).toBeInTheDocument();
  });

  it("renders the bio paragraph", () => {
    render(<Hero />);
    expect(
      screen.getByText(/Technology executive and hands-on architect/i)
    ).toBeInTheDocument();
  });

  it("renders CTA links", () => {
    render(<Hero />);
    expect(screen.getByText("./contact --init")).toBeInTheDocument();
    expect(screen.getByText("cat resume.pdf")).toBeInTheDocument();
  });
});
