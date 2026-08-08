import { describe, expect, it } from "vitest";

import { buildCodexArguments, parseCodexEvent } from "./codex-cli-runtime.ts";

describe("CodexCliRuntime", () => {
  it("builds a non-interactive JSONL invocation with an explicit sandbox", () => {
    expect(
      buildCodexArguments(
        "/tmp/project",
        {
          adapter: "codex-cli",
          provider: "openai-codex",
          model: "gpt-5.6-sol",
          reasoning: "high",
        },
        "workspace-write",
      ),
    ).toEqual([
      "exec",
      "--json",
      "--color",
      "never",
      "--sandbox",
      "workspace-write",
      "--cd",
      "/tmp/project",
      "--model",
      "gpt-5.6-sol",
      "--config",
      'model_reasoning_effort="high"',
      "-",
    ]);
  });

  it("extracts only sparse thread and final-answer information", () => {
    expect(
      parseCodexEvent(
        JSON.stringify({ type: "thread.started", thread_id: "thread-1" }),
      ),
    ).toEqual({ threadId: "thread-1" });
    expect(
      parseCodexEvent(
        JSON.stringify({
          type: "item.completed",
          item: { type: "agent_message", text: "Finished safely." },
        }),
      ),
    ).toEqual({ summary: "Finished safely." });
    expect(parseCodexEvent("not json")).toEqual({});
  });
});
