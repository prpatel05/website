import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import Breadcrumbs from "../Breadcrumbs";

describe("Breadcrumbs", () => {
  it("renders a Home link and the path segments", () => {
    render(
      <MemoryRouter>
        <Breadcrumbs
          segments={[
            { label: "blog", to: "/blog/" },
            { label: "ship-it-yourself" },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "blog" })).toHaveAttribute("href", "/blog/");
    expect(screen.getByText("ship-it-yourself")).toBeInTheDocument();
    expect(screen.getByText("ship-it-yourself")).toHaveAttribute("aria-current", "page");
  });
});
