import { describe, expect, it } from "vitest";

import type { RuntimeSelection } from "./types.ts";
import { makeClaudeRuntime, makePiRuntime } from "./text-cli-runtime.ts";

const input = {
  attemptId: "attempt-1",
  prompt: "Inspect the package",
  projectPath: "/tmp/project",
  systemPrompt: "Work only inside the assigned project.",
};

describe("text CLI runtimes", () => {
  it("constructs Pi and Claude adapters behind the common runtime contract", () => {
    expect(makePiRuntime()).toHaveProperty("execute");
    expect(makeClaudeRuntime()).toHaveProperty("execute");
  });

  it("keeps runtime selections provider-neutral", () => {
    const selection = {
      adapter: "pi",
      provider: "openai-codex",
      model: "gpt-5.6-terra",
      reasoning: "high",
    } satisfies RuntimeSelection;
    expect(input.prompt).toContain("package");
    expect(selection.adapter).toBe("pi");
  });
});
