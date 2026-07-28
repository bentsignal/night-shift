import type * as LanguageModel from "@effect/ai/LanguageModel";
import { AnthropicClient, AnthropicLanguageModel } from "@effect/ai-anthropic";
import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "@effect/platform";
import { Effect, Layer, Redacted } from "effect";

import type { OAuthCredential } from "./credential-store.ts";
import type {
  ModelInvocationContext,
  ModelResolutionError,
  ModelResolverService,
} from "./runtime-services.ts";
import type { ReasoningLevel, RuntimeSelection } from "./types.ts";
import { HostCredentialStore } from "./credential-store.ts";
import {
  ExpiredProviderCredentialError,
  InvalidProviderCredentialError,
  MissingProviderCredentialError,
  UnsupportedProviderError,
} from "./runtime-services.ts";

const CODEX_API_URL = "https://chatgpt.com/backend-api/codex";
const CODEX_ACCOUNT_CLAIM = "https://api.openai.com/auth";
const EXPIRY_SAFETY_MARGIN_MS = 30_000;

export interface ProductionModelResolverOptions {
  credentials: HostCredentialStore;
  openAiApiKey?: string;
  anthropicApiKey?: string;
  now?: () => number;
}

/**
 * Resolves provider/model/reasoning at the host boundary. Workflow code only
 * sees the provider-neutral Effect AI LanguageModel service.
 */
export function productionModelResolver(
  options: ProductionModelResolverOptions,
): ModelResolverService {
  const now = options.now ?? Date.now;
  return {
    resolve: (selection, context) => {
      switch (selection.provider) {
        case "openai-codex":
          return codexSubscriptionModel(
            options.credentials,
            selection,
            context,
            now,
          );
        case "openai":
          return options.openAiApiKey
            ? openAiApiModel(options.openAiApiKey, selection, context)
            : Effect.fail(
                new MissingProviderCredentialError({ provider: "openai" }),
              );
        case "anthropic":
          return options.anthropicApiKey
            ? anthropicApiModel(options.anthropicApiKey, selection)
            : Effect.fail(
                new MissingProviderCredentialError({
                  provider: "anthropic",
                }),
              );
        default:
          return Effect.fail(
            new UnsupportedProviderError({ provider: selection.provider }),
          );
      }
    },
  };
}

function codexSubscriptionModel(
  credentials: HostCredentialStore,
  selection: RuntimeSelection,
  context: ModelInvocationContext | undefined,
  now: () => number,
): Effect.Effect<LanguageModel.Service, ModelResolutionError> {
  return Effect.gen(function* () {
    const credential = yield* Effect.tryPromise({
      try: () => credentials.read("openai-codex"),
      catch: (error) =>
        new InvalidProviderCredentialError({
          provider: "openai-codex",
          message: error instanceof Error ? error.message : String(error),
        }),
    });
    if (!credential) {
      return yield* new MissingProviderCredentialError({
        provider: "openai-codex",
      });
    }
    if (credential.type !== "oauth") {
      return yield* new InvalidProviderCredentialError({
        provider: "openai-codex",
        message: "Expected an OAuth credential",
      });
    }
    if (credential.expires <= now() + EXPIRY_SAFETY_MARGIN_MS) {
      return yield* new ExpiredProviderCredentialError({
        provider: "openai-codex",
        expiredAt: credential.expires,
      });
    }
    const accountId = credential.accountId ?? accountIdFromJwt(credential);
    if (!accountId) {
      return yield* new InvalidProviderCredentialError({
        provider: "openai-codex",
        message: "OAuth credential does not contain a ChatGPT account ID",
      });
    }

    const client = OpenAiClient.layer({
      apiKey: Redacted.make(credential.access),
      apiUrl: CODEX_API_URL,
      transformClient: codexHeaders(accountId),
    }).pipe(Layer.provide(FetchHttpClient.layer));
    return yield* OpenAiLanguageModel.make({
      model: selection.model,
      config: {
        instructions: context?.systemPrompt,
        include: ["reasoning.encrypted_content"],
        parallel_tool_calls: false,
        store: false,
        reasoning: {
          effort: openAiReasoning(selection.reasoning),
          summary: "auto",
        },
      },
    }).pipe(Effect.provide(client));
  });
}

function openAiApiModel(
  apiKey: string,
  selection: RuntimeSelection,
  context: ModelInvocationContext | undefined,
) {
  const client = OpenAiClient.layer({
    apiKey: Redacted.make(apiKey),
  }).pipe(Layer.provide(FetchHttpClient.layer));
  return OpenAiLanguageModel.make({
    model: selection.model,
    config: {
      instructions: context?.systemPrompt,
      reasoning: {
        effort: openAiReasoning(selection.reasoning),
        summary: "auto",
      },
    },
  }).pipe(Effect.provide(client));
}

function anthropicApiModel(apiKey: string, selection: RuntimeSelection) {
  const client = AnthropicClient.layer({
    apiKey: Redacted.make(apiKey),
  }).pipe(Layer.provide(FetchHttpClient.layer));
  return AnthropicLanguageModel.make({
    model: selection.model,
    config: {
      thinking:
        selection.reasoning === "off"
          ? { type: "disabled" }
          : {
              type: "enabled",
              budget_tokens: anthropicThinkingBudget(selection.reasoning),
            },
    },
  }).pipe(Effect.provide(client));
}

function codexHeaders(accountId: string) {
  return (client: HttpClient.HttpClient): HttpClient.HttpClient =>
    client.pipe(
      HttpClient.mapRequest((request) =>
        request.pipe(
          HttpClientRequest.setHeader("chatgpt-account-id", accountId),
          HttpClientRequest.setHeader("originator", "code"),
          HttpClientRequest.setHeader("OpenAI-Beta", "responses=experimental"),
          HttpClientRequest.setHeader("accept", "text/event-stream"),
        ),
      ),
    );
}

export function openAiReasoning(
  reasoning: ReasoningLevel,
): "none" | "minimal" | "low" | "medium" | "high" {
  if (reasoning === "off") return "none";
  // Codex subscription models do not accept the Responses API's `minimal`
  // value. Keep the product-level option provider-neutral and lower it to the
  // nearest supported effort at this transport boundary.
  if (reasoning === "minimal") return "low";
  if (reasoning === "xhigh" || reasoning === "max") return "high";
  return reasoning;
}

function anthropicThinkingBudget(reasoning: ReasoningLevel): number {
  switch (reasoning) {
    case "minimal":
      return 1_024;
    case "low":
      return 2_048;
    case "medium":
      return 4_096;
    case "high":
      return 8_192;
    case "xhigh":
      return 16_384;
    case "max":
      return 32_768;
    case "off":
      return 1_024;
  }
}

function accountIdFromJwt(credential: OAuthCredential): string | undefined {
  try {
    const payloadPart = credential.access.split(".")[1];
    if (!payloadPart) return undefined;
    const payload: unknown = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    );
    if (!payload || typeof payload !== "object") return undefined;
    const auth = (payload as Record<string, unknown>)[CODEX_ACCOUNT_CLAIM];
    if (!auth || typeof auth !== "object") return undefined;
    const accountId = (auth as Record<string, unknown>).chatgpt_account_id;
    return typeof accountId === "string" ? accountId : undefined;
  } catch {
    return undefined;
  }
}
