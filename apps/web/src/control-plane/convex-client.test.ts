import { describe, expect, it } from "vitest";

import { runTitle } from "./convex-client";

describe("runTitle", () => {
  it("keeps a short first line unchanged", () => {
    expect(runTitle("Fix the startup command.\nIgnore later detail.")).toBe(
      "Fix the startup command.",
    );
  });

  it("truncates long prompts at a readable word boundary", () => {
    expect(
      runTitle(
        "Verify the routed shadcn interface queues work from the dedicated new-run page.",
      ),
    ).toBe(
      "Verify the routed shadcn interface queues work from the dedicated…",
    );
  });

  it("provides a title for empty prompts", () => {
    expect(runTitle(" \n ")).toBe("Untitled assignment");
  });
});
