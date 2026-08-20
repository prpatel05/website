import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PostToc from "../PostToc";

const entries = [
  { id: "one", text: "First section" },
  { id: "two", text: "Second section" },
];

describe("PostToc", () => {
  it("renders nothing when there are no H2s", () => {
    const { container } = render(<PostToc entries={[]} activeId="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists each H2 as a hash link under a named landmark", () => {
    render(<PostToc entries={entries} activeId="" />);
    expect(screen.getByRole("navigation", { name: "Contents" })).toBeInTheDocument();
    expect(screen.getByText("// contents")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "First section" })).toHaveAttribute(
      "href",
      "#one"
    );
    expect(screen.getByRole("link", { name: "Second section" })).toHaveAttribute(
      "href",
      "#two"
    );
  });

  it("marks the active section with aria-current", () => {
    render(<PostToc entries={entries} activeId="two" />);
    expect(screen.getByRole("link", { name: "First section" })).not.toHaveAttribute(
      "aria-current"
    );
    expect(screen.getByRole("link", { name: "Second section" })).toHaveAttribute(
      "aria-current",
      "location"
    );
  });
});
