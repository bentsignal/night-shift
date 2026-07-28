import type * as LanguageModel from "@effect/ai/LanguageModel";
import { Context, Data, Effect, Layer } from "effect";

import type { RuntimeMilestone, RuntimeSelection } from "./types.ts";

export class UnsupportedProviderError extends Data.TaggedError(
  "UnsupportedProviderError",
)<{
  readonly provider: string;
}> {
  override get message(): string {
    return `Unsupported model provider: ${this.provider}`;
  }
}

export class MissingProviderCredentialError extends Data.TaggedError(
  "MissingProviderCredentialError",
)<{
  readonly provider: string;
}> {
  override get message(): string {
    return `No host-local credential is available for ${this.provider}`;
  }
}

export class ExpiredProviderCredentialError extends Data.TaggedError(
  "ExpiredProviderCredentialError",
)<{
  readonly provider: string;
  readonly expiredAt: number;
}> {
  override get message(): string {
    return `The host-local ${this.provider} credential expired at ${new Date(this.expiredAt).toISOString()}`;
  }
}

export class InvalidProviderCredentialError extends Data.TaggedError(
  "InvalidProviderCredentialError",
)<{
  readonly provider: string;
  readonly message: string;
}> {}

export type ModelResolutionError =
  | UnsupportedProviderError
  | MissingProviderCredentialError
  | ExpiredProviderCredentialError
  | InvalidProviderCredentialError;

export interface ModelInvocationContext {
  systemPrompt: string;
}

export interface ModelResolverService {
  resolve(
    selection: RuntimeSelection,
    context?: ModelInvocationContext,
  ): Effect.Effect<LanguageModel.Service, ModelResolutionError>;
}

export class ModelResolver extends Context.Tag("@code/worker/ModelResolver")<
  ModelResolver,
  ModelResolverService
>() {}

export function modelResolverLayer(
  service: ModelResolverService,
): Layer.Layer<ModelResolver> {
  return Layer.succeed(ModelResolver, service);
}

export class CheckpointPublishError extends Data.TaggedError(
  "CheckpointPublishError",
)<{
  readonly message: string;
}> {}

export class ProviderRequestError extends Data.TaggedError(
  "ProviderRequestError",
)<{
  readonly provider: string;
}> {
  override get message(): string {
    return `The ${this.provider} model request failed`;
  }
}

interface CheckpointSinkService {
  publish(
    milestone: RuntimeMilestone,
  ): Effect.Effect<void, CheckpointPublishError>;
}

export class CheckpointSink extends Context.Tag("@code/worker/CheckpointSink")<
  CheckpointSink,
  CheckpointSinkService
>() {}

export function checkpointSinkLayer(
  publish: (milestone: RuntimeMilestone) => Promise<void>,
): Layer.Layer<CheckpointSink> {
  return Layer.succeed(CheckpointSink, {
    publish: (milestone) =>
      Effect.tryPromise({
        try: () => publish(milestone),
        catch: (error) =>
          new CheckpointPublishError({
            message: error instanceof Error ? error.message : String(error),
          }),
      }),
  });
}
