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
              k === "aria-labelledby" ||
              k === "role" ||
              k === "action" ||
              k === "method" ||
              k === "name" ||
              k === "type" ||
              k === "required" ||
              k === "placeholder" ||
              k === "htmlFor" ||
              k === "rows" ||
              k === "disabled" ||
              k === "maxLength" ||
              k === "autoComplete" ||
              k === "tabIndex" ||
              k === "aria-hidden"
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

import VC from "../VC";

function renderVC(path = "/vc/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <VC />
    </MemoryRouter>
  );
}

describe("VC page", () => {
  it("renders thesis and pitch form wired to FormSubmit", () => {
    renderVC();
    expect(
      screen.getByRole("heading", { level: 1, name: "Angel investing" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Areas I am watching/i })).toBeInTheDocument();
    expect(screen.getByText("AI agents")).toBeInTheDocument();
    expect(screen.getByLabelText(/name \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company \/ url \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/one-liner \*/i)).toBeInTheDocument();
    const form = screen.getByRole("button", { name: /submit_pitch/i }).closest("form");
    expect(form).toHaveAttribute("action", "https://formsubmit.co/pratik@pa.tel");
    expect(form).toHaveAttribute("method", "POST");
    expect(form?.querySelector('input[name="_captcha"]')).toHaveAttribute("value", "true");
    expect(form?.querySelector('input[name="_blacklist"]')).toBeTruthy();
    const honey = form?.querySelector('input[name="_honey"]') as HTMLInputElement | null;
    expect(honey).toBeTruthy();
    expect(honey).toHaveAttribute("tabIndex", "-1");
    expect(honey).toHaveAttribute("autoComplete", "off");
    expect(honey?.className).toMatch(/-left-\[9999px\]/);
    expect(screen.getByRole("button", { name: /submit_pitch/i })).not.toBeDisabled();
    expect(screen.getByText(/reCAPTCHA and a honeypot/i)).toBeInTheDocument();
  });

  it("shows success state when sent=1", () => {
    renderVC("/vc/?sent=1");
    expect(screen.getByRole("status")).toHaveTextContent(/Thanks/i);
    expect(screen.queryByRole("button", { name: /submit_pitch/i })).not.toBeInTheDocument();
  });

  it("exposes sitemap landmarks via PageShell", () => {
    renderVC();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Sitemap" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "vc" })).toHaveAttribute("href", "/vc/");
  });
});
