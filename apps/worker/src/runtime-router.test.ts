import { describe, expect, it, vi } from "vitest";

import type { RuntimeAdapter, RuntimeSelection } from "./types.ts";
import {
  RuntimeRouter,
  UnsupportedRuntimeAdapterError,
} from "./runtime-router.ts";

const selection = {
  adapter: "codex-cli",
  provider: "openai-codex",
  model: "gpt-5.6-sol",
  reasoning: "high",
} satisfies RuntimeSelection;

describe("RuntimeRouter", () => {
  it("delegates to the explicitly selected runtime", async () => {
    const execute = vi.fn(async () => ({ summary: "done" }));
    const router = new RuntimeRouter([
      ["codex-cli", { execute } satisfies RuntimeAdapter],
    ]);

    await expect(
      router.execute(
        {
          attemptId: "attempt-1",
          prompt: "inspect the repo",
          projectPath: "/tmp/project",
          systemPrompt: "work carefully",
        },
        selection,
        new AbortController().signal,
        async () => undefined,
      ),
    ).resolves.toEqual({ summary: "done" });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("never falls back when a selected adapter is unavailable", async () => {
    const router = new RuntimeRouter([]);

    await expect(
      router.execute(
        {
          attemptId: "attempt-1",
          prompt: "inspect the repo",
          projectPath: "/tmp/project",
          systemPrompt: "work carefully",
        },
        selection,
        new AbortController().signal,
        async () => undefined,
      ),
    ).rejects.toBeInstanceOf(UnsupportedRuntimeAdapterError);
  });
});
