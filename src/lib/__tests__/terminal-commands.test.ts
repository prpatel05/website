import { describe, it, expect } from "vitest";
import { processTerminalCommand, COMMANDS } from "../terminal-commands";

describe("processTerminalCommand", () => {
  // --- help ---
  it("returns all commands for 'help'", () => {
    const result = processTerminalCommand("help");
    expect(result.action).toBe("lines");
    if (result.action !== "lines") return;
    const text = result.lines.map((l) => l.text).join("\n");
    expect(text).toContain("Available Commands");
    for (const cmd of Object.keys(COMMANDS)) {
      expect(text).toContain(cmd);
    }
  });

  // --- about ---
  it("returns scroll action for 'about'", () => {
    const result = processTerminalCommand("about");
    expect(result.action).toBe("scroll");
    if (result.action !== "scroll") return;
    expect(result.id).toBe("about");
    expect(result.lines.some((l) => l.text.includes("Navigating to #about"))).toBe(true);
  });

  // --- contact ---
  it("returns scroll action for 'contact'", () => {
    const result = processTerminalCommand("contact");
    expect(result.action).toBe("scroll");
    if (result.action !== "scroll") return;
    expect(result.id).toBe("contact");
    expect(result.lines.some((l) => l.text.includes("Navigating to #contact"))).toBe(true);
  });

  // --- blog ---
  it("returns navigate action for 'blog'", () => {
    const result = processTerminalCommand("blog");
    expect(result.action).toBe("navigate");
    if (result.action !== "navigate") return;
    expect(result.path).toBe("/blog");
    expect(result.lines.some((l) => l.text.includes("Opening /blog"))).toBe(true);
  });

  // --- resume ---
  it("returns open action with resume URL for 'resume'", () => {
    const result = processTerminalCommand("resume", "/base/");
    expect(result.action).toBe("open");
    if (result.action !== "open") return;
    expect(result.url).toBe("/base/resume.pdf");
    expect(result.lines.some((l) => l.text.includes("Downloading resume.pdf"))).toBe(true);
  });

  it("uses default baseUrl for resume", () => {
    const result = processTerminalCommand("resume");
    if (result.action !== "open") return;
    expect(result.url).toBe("/resume.pdf");
  });

  // --- socials ---
  it("returns social links for 'socials'", () => {
    const result = processTerminalCommand("socials");
    expect(result.action).toBe("lines");
    if (result.action !== "lines") return;
    const text = result.lines.map((l) => l.text).join("\n");
    expect(text).toContain("Social Links");
    expect(text).toContain("linkedin.com/in/prpatel05");
    expect(text).toContain("github.com/prpatel05");
    expect(text).toContain("x.com/prpatel05");
  });

  // --- skills ---
  it("returns tech stack for 'skills'", () => {
    const result = processTerminalCommand("skills");
    expect(result.action).toBe("lines");
    if (result.action !== "lines") return;
    const text = result.lines.map((l) => l.text).join("\n");
    expect(text).toContain("Tech Stack");
    expect(text).toContain("TypeScript/JS");
    expect(text).toContain("React/Next.js");
    expect(text).toContain("AWS/Cloud");
  });

  // --- whoami ---
  it("returns identity info for 'whoami'", () => {
    const result = processTerminalCommand("whoami");
    expect(result.action).toBe("lines");
    if (result.action !== "lines") return;
    const text = result.lines.map((l) => l.text).join("\n");
    expect(text).toContain("Pratik Patel");
    expect(text).toContain("CTO & Chief Architect");
    expect(text).toContain("Washington, DC");
  });

  // --- neofetch ---
  it("returns system info for 'neofetch'", () => {
    const result = processTerminalCommand("neofetch");
    expect(result.action).toBe("lines");
    if (result.action !== "lines") return;
    const text = result.lines.map((l) => l.text).join("\n");
    expect(text).toContain("pratik@portfolio");
    expect(text).toContain("React 18 + Vite");
    expect(text).toContain("Cyberpunk Dark");
  });

  // --- clear ---
  it("returns clear action for 'clear'", () => {
    const result = processTerminalCommand("clear");
    expect(result.action).toBe("clear");
  });

  // --- ls ---
  it("lists site sections for 'ls'", () => {
    const result = processTerminalCommand("ls");
    expect(result.action).toBe("lines");
    if (result.action !== "lines") return;
    const text = result.lines.map((l) => l.text).join("\n");
    expect(text).toContain("about/");
    expect(text).toContain("blog/");
    expect(text).toContain("contact/");
    expect(text).toContain("resume.pdf");
  });

  // --- pwd ---
  it("returns working directory for 'pwd'", () => {
    const result = processTerminalCommand("pwd");
    expect(result.action).toBe("lines");
    if (result.action !== "lines") return;
    expect(result.lines.some((l) => l.text.includes("/home/pratik/portfolio"))).toBe(true);
  });

  // --- date ---
  it("returns current date for 'date'", () => {
    const result = processTerminalCommand("date");
    expect(result.action).toBe("lines");
    if (result.action !== "lines") return;
    const year = new Date().getFullYear().toString();
    expect(result.lines.some((l) => l.text.includes(year))).toBe(true);
  });

  // --- echo ---
  it("echoes user text for 'echo hello world'", () => {
    const result = processTerminalCommand("echo hello world");
    expect(result.action).toBe("lines");
    if (result.action !== "lines") return;
    expect(result.lines.some((l) => l.text.includes("hello world"))).toBe(true);
  });

  it("echoes empty string for bare 'echo'", () => {
    const result = processTerminalCommand("echo");
    expect(result.action).toBe("lines");
    if (result.action !== "lines") return;
    // The echo line should exist with just spaces
    expect(result.lines.some((l) => l.text.trim() === "")).toBe(true);
  });

  // --- unknown command ---
  it("returns error for unknown command", () => {
    const result = processTerminalCommand("foobar");
    expect(result.action).toBe("lines");
    if (result.action !== "lines") return;
    const text = result.lines.map((l) => l.text).join("\n");
    expect(text).toContain("command not found: foobar");
    expect(result.lines.some((l) => l.type === "error")).toBe(true);
  });

  // --- empty input ---
  it("returns empty action for empty input", () => {
    const result = processTerminalCommand("");
    expect(result.action).toBe("empty");
  });

  it("returns empty action for whitespace-only input", () => {
    const result = processTerminalCommand("   ");
    expect(result.action).toBe("empty");
  });

  // --- case insensitive ---
  it("handles uppercase commands", () => {
    const result = processTerminalCommand("PWD");
    expect(result.action).toBe("lines");
    if (result.action !== "lines") return;
    expect(result.lines.some((l) => l.text.includes("/home/pratik/portfolio"))).toBe(true);
  });

  it("handles mixed case commands", () => {
    const result = processTerminalCommand("Help");
    expect(result.action).toBe("lines");
    if (result.action !== "lines") return;
    expect(result.lines.some((l) => l.text.includes("Available Commands"))).toBe(true);
  });

  // --- input line prefix ---
  it("prefixes output with $ and the original command text", () => {
    const result = processTerminalCommand("pwd");
    if (result.action !== "lines") return;
    expect(result.lines[0]).toEqual({ type: "input", text: "$ pwd" });
  });

  it("preserves original casing in the input echo line", () => {
    const result = processTerminalCommand("PWD");
    if (result.action !== "lines") return;
    expect(result.lines[0].text).toBe("$ PWD");
  });

  // --- output has trailing blank line ---
  it("appends a blank output line after command result", () => {
    const result = processTerminalCommand("pwd");
    if (result.action !== "lines") return;
    const last = result.lines[result.lines.length - 1];
    expect(last).toEqual({ type: "output", text: "" });
  });
});

describe("COMMANDS constant", () => {
  it("has 14 commands", () => {
    expect(Object.keys(COMMANDS).length).toBe(14);
  });

  it("includes all documented commands", () => {
    const expected = [
      "help", "about", "blog", "contact", "resume",
      "socials", "skills", "clear", "whoami", "neofetch",
      "ls", "pwd", "date", "echo",
    ];
    for (const cmd of expected) {
      expect(COMMANDS[cmd]).toBeDefined();
    }
  });
});
