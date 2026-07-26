import {
  fauxAssistantMessage,
  fauxProvider,
  InMemoryCredentialStore,
} from "@earendil-works/pi-ai";
import { describe, expect, it, vi } from "vitest";

import { PiRuntimeAdapter } from "./pi-runtime.ts";

describe("PiRuntimeAdapter", () => {
  it("executes through pi-agent-core with a deterministic faux provider", async () => {
    let observedReasoning: string | undefined;
    const faux = fauxProvider({
      provider: "faux",
      models: [{ id: "control", reasoning: true }],
    });
    faux.setResponses([
      (_context, options) => {
        observedReasoning = (options as { reasoning?: string } | undefined)
          ?.reasoning;
        return fauxAssistantMessage("A deterministic local result.");
      },
    ]);
    const adapter = new PiRuntimeAdapter(new InMemoryCredentialStore(), [
      faux.provider,
    ]);
    const emit = vi.fn();

    const result = await adapter.execute(
      {
        attemptId: "attempt-1",
        prompt: "Complete the slice",
        projectPath: process.cwd(),
        systemPrompt: "Test",
      },
      { provider: "faux", model: "control", reasoning: "high" },
      new AbortController().signal,
      emit,
    );

    expect(result.summary).toBe("A deterministic local result.");
    expect(observedReasoning).toBe("high");
    expect(faux.state.callCount).toBe(1);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "checkpoint",
        operationId: "attempt-1:turn:1",
      }),
    );
  });
});
