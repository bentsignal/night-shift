import type { CredentialStore, Provider } from "@earendil-works/pi-ai";
import { Agent } from "@earendil-works/pi-agent-core";
import {
  contentText,
  createModels,
  defaultProviderAuthContext,
} from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";

import type {
  RuntimeAdapter,
  RuntimeInput,
  RuntimeMilestone,
  RuntimeResult,
  RuntimeSelection,
} from "./types.ts";
import { createCodingTools } from "./tools.ts";

export class PiRuntimeAdapter implements RuntimeAdapter {
  readonly #credentials: CredentialStore;
  readonly #providers: readonly Provider[];

  constructor(
    credentials: CredentialStore,
    providers: readonly Provider[] = [
      openaiCodexProvider(),
      anthropicProvider(),
    ],
  ) {
    this.#credentials = credentials;
    this.#providers = providers;
  }

  async execute(
    input: RuntimeInput,
    selection: RuntimeSelection,
    signal: AbortSignal,
    emit: (milestone: RuntimeMilestone) => Promise<void>,
  ): Promise<RuntimeResult> {
    const models = createModels({
      credentials: this.#credentials,
      authContext: defaultProviderAuthContext(),
    });
    for (const provider of this.#providers) models.setProvider(provider);
    const model = models.getModel(selection.provider, selection.model);
    if (!model) {
      throw new Error(
        `Unsupported model ${selection.provider}/${selection.model}`,
      );
    }

    const agent = new Agent({
      initialState: {
        systemPrompt: input.systemPrompt,
        model,
        thinkingLevel: selection.reasoning,
        tools: createCodingTools(input.projectPath),
      },
      streamFn: models.streamSimple.bind(models),
      sessionId: input.attemptId,
      toolExecution: "sequential",
      beforeToolCall: async () =>
        signal.aborted
          ? {
              block: true,
              reason: "Cloud authority or the fenced lease was lost.",
            }
          : undefined,
    });

    let turn = 0;
    let latestSummary = "Agent execution finished.";
    agent.subscribe(async (event) => {
      if (event.type !== "turn_end") return;
      turn += 1;
      if (event.message.role === "assistant") {
        latestSummary =
          contentText(event.message.content).trim().slice(-2_000) ||
          latestSummary;
      }
      await emit({
        kind: "checkpoint",
        operationId: `${input.attemptId}:turn:${turn}`,
        summary: latestSummary,
      });
    });

    const abort = () => agent.abort();
    signal.addEventListener("abort", abort, { once: true });
    try {
      signal.throwIfAborted();
      await agent.prompt(input.prompt);
      await agent.waitForIdle();
      signal.throwIfAborted();
      if (agent.state.errorMessage) {
        throw new Error(agent.state.errorMessage);
      }
      return { summary: latestSummary };
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }
}
