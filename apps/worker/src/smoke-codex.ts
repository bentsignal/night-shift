import { Chunk, Effect, Stream } from "effect";

import { HostCredentialStore } from "./credential-store.ts";
import { productionModelResolver } from "./providers.ts";
import { ProviderRequestError } from "./runtime-services.ts";

if (process.env.NIGHT_SHIFT_LIVE_CODEX_SMOKE !== "1") {
  throw new Error(
    "Refusing a provider request without NIGHT_SHIFT_LIVE_CODEX_SMOKE=1",
  );
}

const resolver = productionModelResolver({
  credentials: new HostCredentialStore(),
});
const modelName = process.env.NIGHT_SHIFT_CODEX_SMOKE_MODEL ?? "gpt-5.6-sol";
const program = Effect.gen(function* () {
  const model = yield* resolver.resolve(
    {
      provider: "openai-codex",
      model: modelName,
      reasoning: "minimal",
    },
    {
      systemPrompt: "You are a transport health check.",
    },
  );
  const parts = yield* model
    .streamText({
      prompt:
        "Reply with exactly: Effect Codex subscription transport is online.",
      toolChoice: "none",
    })
    .pipe(
      Stream.runCollect,
      Effect.mapError(
        () => new ProviderRequestError({ provider: "openai-codex" }),
      ),
    );
  const text = Chunk.toReadonlyArray(parts)
    .flatMap((part) => (part.type === "text-delta" ? [part.delta] : []))
    .join("")
    .trim();
  if (!text) {
    return yield* Effect.fail(
      new Error("Codex subscription smoke returned no text"),
    );
  }
  return text;
});

const result = await Effect.runPromise(program);
process.stdout.write(`Codex subscription smoke succeeded: ${result}\n`);
