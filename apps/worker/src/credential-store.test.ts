import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  CodexCliCredentialFallback,
  HostCredentialStore,
} from "./credential-store.ts";

const temporaryDirectories = new Array<string>();

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("HostCredentialStore", () => {
  it("serializes modifications and preserves provider OAuth fields", async () => {
    const directory = await mkdtemp(join(tmpdir(), "night-shift-worker-auth-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "auth.json");
    const store = new HostCredentialStore(path);

    await store.modify("openai-codex", async () => ({
      type: "oauth",
      access: "access",
      refresh: "refresh",
      expires: 1,
      accountId: "acct_123",
    }));
    await Promise.all([
      store.modify("openai-codex", async (credential) => ({
        ...credential!,
        access: "new-access",
      })),
      store.modify("openai-codex", async (credential) => ({
        ...credential!,
        expires: 2,
      })),
    ]);

    const credential = await store.read("openai-codex");
    expect(credential).toMatchObject({
      type: "oauth",
      access: "new-access",
      expires: 2,
      accountId: "acct_123",
    });
    const persisted = JSON.parse(await readFile(path, "utf8")) as Record<
      string,
      unknown
    >;
    expect(persisted["openai-codex"]).toEqual(credential);
  });

  it("prefers a newer read-only Codex CLI subscription credential", async () => {
    const directory = await mkdtemp(join(tmpdir(), "night-shift-codex-auth-"));
    temporaryDirectories.push(directory);
    const primary = new HostCredentialStore(
      join(directory, "night-shift.json"),
    );
    await primary.modify("openai-codex", async () => ({
      type: "oauth",
      access: jwtWithExpiration(1),
      expires: 1_000,
      accountId: "old-account",
    }));
    const codexPath = join(directory, "codex.json");
    await writeFile(
      codexPath,
      JSON.stringify({
        tokens: {
          access_token: jwtWithExpiration(5),
          refresh_token: "host-local-refresh",
          account_id: "current-account",
        },
      }),
    );

    const credential = await new CodexCliCredentialFallback(
      primary,
      codexPath,
    ).read("openai-codex");

    expect(credential).toMatchObject({
      type: "oauth",
      expires: 5_000,
      accountId: "current-account",
    });
  });
});

function jwtWithExpiration(expiration: number) {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify({ exp: expiration })).toString(
    "base64url",
  );
  return `${header}.${payload}.signature`;
}
