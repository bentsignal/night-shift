import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";

export interface ApiKeyCredential {
  type: "api_key";
  key: string;
  [key: string]: unknown;
}

export interface OAuthCredential {
  type: "oauth";
  access: string;
  refresh?: string;
  expires: number;
  accountId?: string;
  [key: string]: unknown;
}

export type ProviderCredential = ApiKeyCredential | OAuthCredential;

export interface ProviderCredentialReader {
  read(providerId: string): Promise<ProviderCredential | undefined>;
}

export interface CredentialInfo {
  providerId: string;
  type: ProviderCredential["type"];
}

type CredentialFile = Record<string, ProviderCredential>;

/**
 * Host-local provider credentials. Convex never receives values from this
 * store. The default path remains compatible with existing Pi OAuth logins
 * during the migration, but the type and lifecycle are product-owned.
 */
export class HostCredentialStore {
  readonly #path: string;
  readonly #lockPath: string;
  readonly #chains = new Map<string, Promise<unknown>>();

  constructor(path = defaultCredentialPath()) {
    this.#path = path;
    this.#lockPath = `${path}.lock`;
  }

  async read(providerId: string): Promise<ProviderCredential | undefined> {
    return (await this.#readAll())[providerId];
  }

  async list(): Promise<readonly CredentialInfo[]> {
    const credentials = await this.#readAll();
    return Object.entries(credentials).map(([providerId, credential]) => ({
      providerId,
      type: credential.type,
    }));
  }

  modify(
    providerId: string,
    fn: (
      current: ProviderCredential | undefined,
    ) => Promise<ProviderCredential | undefined>,
  ): Promise<ProviderCredential | undefined> {
    return this.#enqueue(providerId, async () =>
      this.#withFileLock(async () => {
        const credentials = await this.#readAll();
        const current = credentials[providerId];
        const next = await fn(current);
        if (next === undefined) return current;
        credentials[providerId] = next;
        await this.#writeAll(credentials);
        return next;
      }),
    );
  }

  async delete(providerId: string): Promise<void> {
    await this.#enqueue(providerId, async () =>
      this.#withFileLock(async () => {
        const credentials = await this.#readAll();
        if (!(providerId in credentials)) return;
        delete credentials[providerId];
        await this.#writeAll(credentials);
      }),
    );
  }

  async #readAll(): Promise<CredentialFile> {
    try {
      const contents = await readFile(this.#path, "utf8");
      const value = JSON.parse(contents) as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Credential file must contain a provider-keyed object");
      }
      return value as CredentialFile;
    } catch (error) {
      if (isNotFound(error)) return {};
      throw error;
    }
  }

  async #writeAll(credentials: CredentialFile): Promise<void> {
    await mkdir(dirname(this.#path), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.#path}.${process.pid}.tmp`;
    await writeFile(
      temporaryPath,
      `${JSON.stringify(credentials, null, 2)}\n`,
      { mode: 0o600 },
    );
    await rename(temporaryPath, this.#path);
  }

  async #withFileLock<T>(operation: () => Promise<T>): Promise<T> {
    await mkdir(dirname(this.#path), { recursive: true, mode: 0o700 });
    let handle;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        handle = await open(this.#lockPath, "wx", 0o600);
        break;
      } catch (error) {
        if (!isAlreadyExists(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    if (!handle) throw new Error("Timed out acquiring credential store lock");
    try {
      return await operation();
    } finally {
      await handle.close();
      await unlink(this.#lockPath).catch(() => undefined);
    }
  }

  #enqueue<T>(providerId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.#chains.get(providerId) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    this.#chains.set(
      providerId,
      current.finally(() => {
        if (this.#chains.get(providerId) === current) {
          this.#chains.delete(providerId);
        }
      }),
    );
    return current;
  }
}

/**
 * Keeps Night Shift's writable credential store product-owned while allowing
 * the Effect harness to reuse a current, host-local Codex CLI subscription
 * login. This bridge is read-only and intentionally understands only the
 * narrow token fields needed by the existing Codex transport.
 */
export class CodexCliCredentialFallback implements ProviderCredentialReader {
  readonly #primary: ProviderCredentialReader;
  readonly #codexAuthPath: string;

  constructor(
    primary: ProviderCredentialReader,
    codexAuthPath = join(
      process.env.CODEX_HOME ??
        join(process.env.HOME ?? process.cwd(), ".codex"),
      "auth.json",
    ),
  ) {
    this.#primary = primary;
    this.#codexAuthPath = codexAuthPath;
  }

  async read(providerId: string): Promise<ProviderCredential | undefined> {
    const primary = await this.#primary.read(providerId);
    if (providerId !== "openai-codex") return primary;
    const codex = await this.#readCodexCredential();
    if (!primary) return codex;
    if (!codex) return primary;
    if (primary.type !== "oauth") return primary;
    return codex.expires > primary.expires ? codex : primary;
  }

  async #readCodexCredential(): Promise<OAuthCredential | undefined> {
    let value: unknown;
    try {
      value = JSON.parse(
        await readFile(this.#codexAuthPath, "utf8"),
      ) as unknown;
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Codex auth file must contain an object");
    }
    const tokens = (value as Record<string, unknown>).tokens;
    if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) {
      return undefined;
    }
    const tokenRecord = tokens as Record<string, unknown>;
    const access = tokenRecord.access_token;
    if (typeof access !== "string") return undefined;
    const expires = jwtExpiration(access);
    if (expires === undefined) {
      throw new Error("Codex access token does not contain an expiration");
    }
    return {
      type: "oauth",
      access,
      refresh:
        typeof tokenRecord.refresh_token === "string"
          ? tokenRecord.refresh_token
          : undefined,
      expires,
      accountId:
        typeof tokenRecord.account_id === "string"
          ? tokenRecord.account_id
          : undefined,
    };
  }
}

function defaultCredentialPath() {
  if (process.env.NIGHT_SHIFT_PROVIDER_AUTH_FILE) {
    return process.env.NIGHT_SHIFT_PROVIDER_AUTH_FILE;
  }
  const base =
    process.env.PI_CODING_AGENT_DIR ??
    join(process.env.HOME ?? process.cwd(), ".pi", "agent");
  return join(base, "auth.json");
}

function jwtExpiration(token: string) {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return undefined;
    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    ) as unknown;
    if (!payload || typeof payload !== "object") return undefined;
    const expiration = (payload as Record<string, unknown>).exp;
    return typeof expiration === "number" ? expiration * 1_000 : undefined;
  } catch {
    return undefined;
  }
}

function isNotFound(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function isAlreadyExists(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EEXIST"
  );
}
