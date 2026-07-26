import { hostname } from "node:os";

import { ConvexWorkerAuthority } from "./convex-authority";
import { PiCredentialStore } from "./credential-store";
import { WorkerDaemon } from "./daemon";
import { PiRuntimeAdapter } from "./pi-runtime";
import { CommandValidator } from "./validator";

const convexUrl = requiredEnvironment("CONVEX_URL");
const ownerId = process.env.CODE_OWNER_ID ?? "personal";
const hostKey = process.env.CODE_HOST_KEY ?? hostname();

const daemon = new WorkerDaemon({
  authority: new ConvexWorkerAuthority(convexUrl, ownerId),
  runtime: new PiRuntimeAdapter(new PiCredentialStore()),
  validator: new CommandValidator(),
  hostKey,
  displayName: process.env.CODE_HOST_NAME ?? hostname(),
  capabilities: {
    platform: process.platform,
    arch: process.arch,
    maxConcurrent: 1,
    providers: ["openai-codex", "anthropic"],
    adapterVersion: "0.1.0",
  },
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => daemon.stop());
}

await daemon.run();

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
