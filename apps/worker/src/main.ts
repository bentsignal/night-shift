import { hostname } from "node:os";
import {
  fauxAssistantMessage,
  fauxProvider,
  InMemoryCredentialStore,
} from "@earendil-works/pi-ai";

import { ConvexWorkerAuthority } from "./convex-authority.ts";
import { PiCredentialStore } from "./credential-store.ts";
import { WorkerDaemon } from "./daemon.ts";
import { PiRuntimeAdapter } from "./pi-runtime.ts";
import { CommandValidator } from "./validator.ts";

const convexUrl = requiredEnvironment("CONVEX_URL");
const ownerId = process.env.CODE_OWNER_ID ?? "personal";
const hostKey = process.env.CODE_HOST_KEY ?? hostname();

const deterministic = process.env.CODE_RUNTIME_MODE === "faux";
const runtime = deterministic
  ? createDeterministicRuntime()
  : new PiRuntimeAdapter(new PiCredentialStore());

const daemon = new WorkerDaemon({
  authority: new ConvexWorkerAuthority(convexUrl, ownerId),
  runtime,
  validator: new CommandValidator(),
  hostKey,
  displayName: process.env.CODE_HOST_NAME ?? hostname(),
  capabilities: {
    platform: process.platform,
    arch: process.arch,
    maxConcurrent: 1,
    providers: deterministic ? ["faux"] : ["openai-codex", "anthropic"],
    adapterVersion: "0.1.0",
  },
  renewEveryMs: Number(process.env.CODE_LEASE_RENEW_MS ?? 30_000),
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

function createDeterministicRuntime() {
  const faux = fauxProvider({
    provider: "faux",
    models: [{ id: "control", reasoning: true }],
    tokensPerSecond: Number(process.env.CODE_FAUX_TOKENS_PER_SECOND ?? 1_000),
  });
  faux.setResponses(
    Array.from({ length: 100 }, () =>
      fauxAssistantMessage(
        "Deterministic local agent execution completed; validation is next.",
      ),
    ),
  );
  return new PiRuntimeAdapter(new InMemoryCredentialStore(), [faux.provider]);
}
