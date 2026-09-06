import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CrtNoiseProvider } from "../CrtNoiseProvider";
import { CRT_NOISE_KEY } from "@/lib/site-preferences";
import StatusBar from "../StatusBar";

vi.mock("@/hooks/useBuildInfo", () => ({
  useBuildInfo: () => ({
    shortSha: "abc1234",
    deployed: "Sep 6, 2026",
    newestTitle: "Newest Post",
    newestSlug: "newest-post",
  }),
}));

function renderBar() {
  return render(
    <MemoryRouter>
      <CrtNoiseProvider>
        <StatusBar />
      </CrtNoiseProvider>
    </MemoryRouter>
  );
}

describe("StatusBar – CRT toggle", () => {
  beforeEach(() => {
    window.localStorage.removeItem(CRT_NOISE_KEY);
  });

  it("defaults to crt: off and persists an on preference", () => {
    renderBar();
    const btn = screen.getByRole("button", { name: /Turn CRT noise on/i });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveTextContent("crt: off");

    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: /Turn CRT noise off/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(window.localStorage.getItem(CRT_NOISE_KEY)).toBe("1");
  });
});
