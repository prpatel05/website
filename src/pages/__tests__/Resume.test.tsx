import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

vi.mock("framer-motion", () => {
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, prop) => {
        return ({ children, ...props }: Record<string, unknown>) => {
          const htmlProps: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(props)) {
            if (
              k === "className" ||
              k === "style" ||
              k === "href" ||
              k === "to" ||
              k === "id" ||
              k === "aria-labelledby"
            ) {
              htmlProps[k] = v;
            }
          }
          const Tag = typeof prop === "string" ? prop : "div";
          return <Tag {...htmlProps}>{children}</Tag>;
        };
      },
    }
  );
  return {
    m: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock("react-helmet-async", () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="helmet">{children}</div>
  ),
  HelmetProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import Resume from "../Resume";

function renderResume() {
  return render(
    <MemoryRouter initialEntries={["/resume/"]}>
      <Resume />
    </MemoryRouter>
  );
}

describe("Resume page", () => {
  it("renders the designed resume with PDF download", () => {
    renderResume();
    expect(
      screen.getByRole("heading", { level: 1, name: "Pratik Patel" })
    ).toBeInTheDocument();
    expect(screen.getByText(/CTO & Chief Architect/)).toBeInTheDocument();
    expect(screen.getByText("Tarobase (poof.new)")).toBeInTheDocument();
    expect(screen.getByText("Amazon Web Services")).toBeInTheDocument();
    const pdf = screen.getByRole("link", { name: /download resume\.pdf/i });
    expect(pdf.getAttribute("href")).toMatch(/resume\.pdf$/);
  });

  it("exposes sitemap landmarks via PageShell", () => {
    renderResume();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Sitemap" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "resume" })).toHaveAttribute(
      "href",
      "/resume/"
    );
  });
});
