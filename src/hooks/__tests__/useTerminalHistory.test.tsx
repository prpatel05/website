import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTerminalHistory } from "../useTerminalHistory";

/**
 * The contract these tests pin is the one every shell has: the line you are
 * part-way through typing is a place in the history, not something the arrow
 * keys are free to overwrite.
 *
 * `navigateDown` used to return `""` at the bottom of the history and the
 * caller assigned it unconditionally, so ArrowDown — the caret-to-end reflex,
 * and `preventDefault`ed here, so there was no native behaviour left either —
 * erased whatever had been typed. `navigateUp` had a guard; `navigateDown`
 * never got one.
 */
describe("useTerminalHistory", () => {
  const setup = () => renderHook(() => useTerminalHistory());

  it("walks back through submitted commands, newest first", () => {
    const { result } = setup();
    act(() => {
      result.current.push("help");
      result.current.push("whoami");
    });

    expect(result.current.navigateUp("")).toBe("whoami");
    expect(result.current.navigateUp("")).toBe("help");
  });

  // Past the oldest entry the line already *is* that command, so declining
  // leaves the same text on screen as re-returning it would — and it does not
  // clobber an edit the visitor made to the recalled line.
  it("stops at the oldest command rather than running off the end", () => {
    const { result } = setup();
    act(() => result.current.push("help"));

    expect(result.current.navigateUp("")).toBe("help");
    expect(result.current.navigateUp("help")).toBeUndefined();
  });

  it("still walks back down after being stopped at the oldest command", () => {
    const { result } = setup();
    act(() => result.current.push("help"));

    expect(result.current.navigateUp("ech")).toBe("help");
    expect(result.current.navigateUp("help")).toBeUndefined();
    expect(result.current.navigateDown()).toBe("ech");
  });

  it("leaves the line alone when there is no history to walk", () => {
    const { result } = setup();

    expect(result.current.navigateUp("neofetc")).toBeUndefined();
  });

  // The defect: ArrowDown with nothing below it wiped the line.
  it("leaves a typed line alone when there is nothing below it", () => {
    const { result } = setup();
    act(() => result.current.push("help"));

    expect(result.current.navigateDown()).toBeUndefined();
  });

  it("leaves a typed line alone on ArrowDown with no history at all", () => {
    const { result } = setup();

    expect(result.current.navigateDown()).toBeUndefined();
  });

  // The other half: the draft has to come back, not just survive.
  it("restores the in-progress draft when walking back down to the bottom", () => {
    const { result } = setup();
    act(() => result.current.push("help"));

    expect(result.current.navigateUp("ech")).toBe("help");
    expect(result.current.navigateDown()).toBe("ech");
  });

  it("restores the draft from deeper in the history", () => {
    const { result } = setup();
    act(() => {
      result.current.push("help");
      result.current.push("whoami");
    });

    expect(result.current.navigateUp("dr")).toBe("whoami");
    expect(result.current.navigateUp("whoami")).toBe("help");
    expect(result.current.navigateDown()).toBe("whoami");
    expect(result.current.navigateDown()).toBe("dr");
  });

  it("restores an empty draft as empty, not as the last command", () => {
    const { result } = setup();
    act(() => result.current.push("help"));

    expect(result.current.navigateUp("")).toBe("help");
    expect(result.current.navigateDown()).toBe("");
  });

  // Submitting resets the cursor, so the next ArrowUp starts from the top
  // again and the old draft is not resurrected under the new command.
  it("drops the stashed draft once a command is submitted", () => {
    const { result } = setup();
    act(() => result.current.push("help"));

    expect(result.current.navigateUp("stale")).toBe("help");
    act(() => result.current.push("whoami"));

    expect(result.current.navigateUp("")).toBe("whoami");
    expect(result.current.navigateDown()).toBe("");
  });

  it("ignores whitespace-only submissions but still resets the cursor", () => {
    const { result } = setup();
    act(() => {
      result.current.push("help");
      result.current.push("   ");
    });

    expect(result.current.navigateUp("")).toBe("help");
    expect(result.current.navigateUp("help")).toBeUndefined();
  });
});
