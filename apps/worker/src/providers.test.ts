import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { HostCredentialStore } from "./credential-store.ts";
import { openAiReasoning, productionModelResolver } from "./providers.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("productionModelResolver", () => {
  it("normalizes provider-neutral minimal reasoning for Codex Responses", () => {
    expect(openAiReasoning("minimal")).toBe("low");
  });

  it("fails with a typed missing credential instead of falling back providers", async () => {
    const store = await credentialStore();
    const resolver = productionModelResolver({ credentials: store });

    const result = await Effect.runPromiseExit(
      resolver.resolve({
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        reasoning: "high",
      }),
    );

    expect(result._tag).toBe("Failure");
    expect(String(result)).toContain("MissingProviderCredentialError");
  });

  it("rejects expired subscription OAuth before any provider request", async () => {
    const store = await credentialStore();
    await store.modify("openai-codex", async () => ({
      type: "oauth",
      access: "expired-access",
      expires: 1_000,
      accountId: "account-1",
    }));
    const resolver = productionModelResolver({
      credentials: store,
      now: () => 10_000,
    });

    const result = await Effect.runPromiseExit(
      resolver.resolve({
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        reasoning: "high",
      }),
    );

    expect(result._tag).toBe("Failure");
    expect(String(result)).toContain("ExpiredProviderCredentialError");
  });

  it("constructs the Codex subscription model without exposing its token", async () => {
    const store = await credentialStore();
    const access = jwtWithAccountId("account-1");
    await store.modify("openai-codex", async () => ({
      type: "oauth",
      access,
      refresh: "host-local-refresh",
      expires: 100_000,
    }));
    const resolver = productionModelResolver({
      credentials: store,
      now: () => 1_000,
    });

    const result = await Effect.runPromiseExit(
      resolver.resolve({
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        reasoning: "xhigh",
      }),
    );

    expect(result._tag).toBe("Success");
    expect(String(result)).not.toContain(access);
    expect(String(result)).not.toContain("host-local-refresh");
  });

  it("keeps unsupported providers explicit", async () => {
    const store = await credentialStore();
    const resolver = productionModelResolver({ credentials: store });

    const result = await Effect.runPromiseExit(
      resolver.resolve({
        provider: "unknown-provider",
        model: "unknown-model",
        reasoning: "medium",
      }),
    );

    expect(result._tag).toBe("Failure");
    expect(String(result)).toContain("UnsupportedProviderError");
  });
});

async function credentialStore(): Promise<HostCredentialStore> {
  const directory = await mkdtemp(join(tmpdir(), "code-provider-test-"));
  temporaryDirectories.push(directory);
  return new HostCredentialStore(join(directory, "auth.json"));
}

function jwtWithAccountId(accountId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
    "base64url",
  );
  const payload = Buffer.from(
    JSON.stringify({
      "https://api.openai.com/auth": {
        chatgpt_account_id: accountId,
      },
    }),
  ).toString("base64url");
  return `${header}.${payload}.signature`;
}
