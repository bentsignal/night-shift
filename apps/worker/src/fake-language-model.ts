import type { Response } from "@effect/ai";
import { LanguageModel } from "@effect/ai";
import { Effect, Stream } from "effect";

import type { ModelResolverService } from "./runtime-services.ts";

export function deterministicModelResolver(
  text = "Deterministic local agent execution completed; validation is next.",
): ModelResolverService {
  return {
    resolve: () =>
      LanguageModel.make({
        generateText: () =>
          Effect.succeed([
            { type: "text", text },
          ] satisfies Array<Response.PartEncoded>),
        streamText: () =>
          Stream.fromIterable([
            { type: "text-start", id: "deterministic-text" },
            {
              type: "text-delta",
              id: "deterministic-text",
              delta: text,
            },
            { type: "text-end", id: "deterministic-text" },
          ] satisfies Array<Response.StreamPartEncoded>),
      }),
  };
}
