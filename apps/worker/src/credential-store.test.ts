import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { PiCredentialStore } from "./credential-store.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("PiCredentialStore", () => {
  it("serializes modifications and preserves provider OAuth fields", async () => {
    const directory = await mkdtemp(join(tmpdir(), "code-worker-auth-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "auth.json");
    const store = new PiCredentialStore(path);

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
});
