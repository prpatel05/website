import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";


import Contact from "../Contact";

describe("Contact", () => {
  it("links email, phone, and the booking page", () => {
    render(
      <MemoryRouter>
        <Contact />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: /pratik@pa\.tel/ })).toHaveAttribute(
      "href",
      "mailto:pratik@pa.tel"
    );
    const book = screen.getByRole("link", { name: /Book a call/ });
    expect(book).toHaveAttribute("href", "/book/");
    // Internal route: no new tab, no cal.com request from the home page.
    expect(book).not.toHaveAttribute("target");
  });
});
