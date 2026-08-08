import { hostname } from "node:os";

import { CodexCliRuntime } from "./codex-cli-runtime.ts";
import { ConvexWorkerAuthority } from "./convex-authority.ts";
import {
  CodexCliCredentialFallback,
  HostCredentialStore,
} from "./credential-store.ts";
import { WorkerDaemon } from "./daemon.ts";
import { EffectRuntimeAdapter } from "./effect-runtime.ts";
import { deterministicModelResolver } from "./fake-language-model.ts";
import { productionModelResolver } from "./providers.ts";
import { RuntimeRouter } from "./runtime-router.ts";
import { makeClaudeRuntime, makePiRuntime } from "./text-cli-runtime.ts";
import { CommandValidator } from "./validator.ts";

const convexUrl = requiredEnvironment("CONVEX_URL");
const ownerId = process.env.NIGHT_SHIFT_OWNER_ID ?? "personal";
const hostKey = process.env.NIGHT_SHIFT_HOST_KEY ?? hostname();
const runtimeAdapters = ["effect-ai", "codex-cli", "pi"];
if (process.env.NIGHT_SHIFT_ENABLE_CLAUDE === "1") {
  runtimeAdapters.push("claude-code");
}

const deterministic = process.env.NIGHT_SHIFT_RUNTIME_MODE === "faux";
const credentials = new CodexCliCredentialFallback(new HostCredentialStore());
const resolver = deterministic
  ? deterministicModelResolver()
  : productionModelResolver({
      credentials,
      openAiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    });
const effectRuntime = new EffectRuntimeAdapter(resolver);
const runtime = new RuntimeRouter([
  ["effect-ai", effectRuntime],
  [
    "codex-cli",
    new CodexCliRuntime({
      sandbox: codexSandbox(process.env.NIGHT_SHIFT_CODEX_SANDBOX),
    }),
  ],
  ["pi", makePiRuntime()],
  ["claude-code", makeClaudeRuntime()],
]);

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
      ? ["faux", "openai-codex"]
      : ["openai-codex", "openai", "anthropic"],
    runtimeAdapters,
    adapterVersion: "night-shift-runtime/0.1.0",
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

function codexSandbox(value: string | undefined) {
  if (value === "read-only" || value === "danger-full-access") return value;
  return "workspace-write";
}
