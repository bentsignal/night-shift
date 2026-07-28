import { hostname } from "node:os";

import { ConvexWorkerAuthority } from "./convex-authority.ts";
import { HostCredentialStore } from "./credential-store.ts";
import { WorkerDaemon } from "./daemon.ts";
import { EffectRuntimeAdapter } from "./effect-runtime.ts";
import { deterministicModelResolver } from "./fake-language-model.ts";
import { productionModelResolver } from "./providers.ts";
import { CommandValidator } from "./validator.ts";

const convexUrl = requiredEnvironment("CONVEX_URL");
const ownerId = process.env.NIGHT_SHIFT_OWNER_ID ?? "personal";
const hostKey = process.env.NIGHT_SHIFT_HOST_KEY ?? hostname();

const deterministic = process.env.NIGHT_SHIFT_RUNTIME_MODE === "faux";
const credentials = new HostCredentialStore();
const resolver = deterministic
  ? deterministicModelResolver()
  : productionModelResolver({
      credentials,
      openAiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    });
const runtime = new EffectRuntimeAdapter(resolver);

const daemon = new WorkerDaemon({
  authority: new ConvexWorkerAuthority(convexUrl, ownerId),
  runtime,
  validator: new CommandValidator(),
  hostKey,
  displayName: process.env.NIGHT_SHIFT_HOST_NAME ?? hostname(),
  capabilities: {
    platform: process.platform,
    arch: process.arch,
    maxConcurrent: 1,
    providers: deterministic
      ? ["faux"]
      : ["openai-codex", "openai", "anthropic"],
    adapterVersion: "effect-ai/0.1.0",
  },
  renewEveryMs: Number(process.env.NIGHT_SHIFT_LEASE_RENEW_MS ?? 30_000),
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => daemon.stop());
}

await daemon.run();

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
