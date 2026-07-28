import { Chat, LanguageModel, Response, Toolkit } from "@effect/ai";
import { Chunk, Data, Effect, Layer, Stream } from "effect";

import type { ModelResolverService } from "./runtime-services.ts";
import type {
  RuntimeAdapter,
  RuntimeInput,
  RuntimeMilestone,
  RuntimeResult,
  RuntimeSelection,
} from "./types.ts";
import {
  CheckpointSink,
  checkpointSinkLayer,
  ModelResolver,
  modelResolverLayer,
  ProviderRequestError,
} from "./runtime-services.ts";
import {
  CodingToolkit,
  CodingToolkitHandlers,
  workspaceLayer,
} from "./tools.ts";

const DEFAULT_MAX_TURNS = 24;
const MAX_CHECKPOINT_CHARACTERS = 2_000;

export class TurnLimitExceededError extends Data.TaggedError(
  "TurnLimitExceededError",
)<{
  readonly maxTurns: number;
}> {
  override get message(): string {
    return `Agent exceeded the ${this.maxTurns}-turn execution limit`;
  }
}

export interface EffectRuntimeAdapterOptions {
  maxTurns?: number;
}

/**
 * Product-owned agent harness. Effect AI owns one model response and its tool
 * resolution; this adapter owns the bounded continuation loop and the sparse
 * orchestration checkpoints around those responses.
 */
export class EffectRuntimeAdapter implements RuntimeAdapter {
  readonly #resolverLayer: Layer.Layer<ModelResolver>;
  readonly #maxTurns: number;

  constructor(
    resolver: ModelResolverService,
    options: EffectRuntimeAdapterOptions = {},
  ) {
    this.#resolverLayer = modelResolverLayer(resolver);
    this.#maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
  }

  execute(
    input: RuntimeInput,
    selection: RuntimeSelection,
    signal: AbortSignal,
    emit: (milestone: RuntimeMilestone) => Promise<void>,
  ): Promise<RuntimeResult> {
    const program = runAgent(input, selection, this.#maxTurns).pipe(
      Effect.provide(CodingToolkitHandlers),
      Effect.provide(workspaceLayer(input.projectPath)),
      Effect.provide(checkpointSinkLayer(emit)),
      Effect.provide(this.#resolverLayer),
    );
    return Effect.runPromise(program, { signal });
  }
}

function runAgent(
  input: RuntimeInput,
  selection: RuntimeSelection,
  maxTurns: number,
) {
  return Effect.gen(function* () {
    const resolver = yield* ModelResolver;
    const checkpoints = yield* CheckpointSink;
    const model = yield* resolver.resolve(selection, {
      systemPrompt: input.systemPrompt,
    });
    const chat = yield* Chat.fromPrompt([
      { role: "system", content: input.systemPrompt },
    ]);
    let prompt = input.prompt as Parameters<
      typeof chat.streamText
    >[0]["prompt"];
    let latestSummary = "Agent execution finished.";

    for (let turn = 1; turn <= maxTurns; turn += 1) {
      const parts = yield* chat
        .streamText({
          prompt,
          toolkit: CodingToolkit,
          concurrency: 1,
        })
        .pipe(
          Stream.runCollect,
          Effect.provideService(LanguageModel.LanguageModel, model),
          Effect.mapError(
            () =>
              new ProviderRequestError({
                provider: selection.provider,
              }),
          ),
        );
      const snapshot = summarizeTurn(Chunk.toReadonlyArray(parts));
      latestSummary = snapshot.summary || latestSummary;
      yield* checkpoints.publish({
        kind: "checkpoint",
        operationId: `${input.attemptId}:turn:${turn}`,
        summary: latestSummary,
      });
      if (!snapshot.calledTools) return { summary: latestSummary };
      prompt = [];
    }

    return yield* new TurnLimitExceededError({ maxTurns });
  });
}

function summarizeTurn(
  parts: ReadonlyArray<
    Response.StreamPart<Toolkit.Tools<typeof CodingToolkit>>
  >,
) {
  const text = new Array<string>();
  const tools = new Array<string>();
  for (const part of parts) {
    if (part.type === "text-delta") text.push(part.delta);
    if (part.type === "tool-call") tools.push(part.name);
  }
  const answer = text.join("").trim();
  return {
    summary: (
      answer ||
      (tools.length > 0
        ? `Executed ${tools.join(", ")}; continuing.`
        : "Agent execution finished.")
    ).slice(-MAX_CHECKPOINT_CHARACTERS),
    calledTools: tools.length > 0,
  };
}
