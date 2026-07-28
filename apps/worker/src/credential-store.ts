import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  Credential,
  CredentialInfo,
  CredentialStore,
} from "@earendil-works/pi-ai";

type CredentialFile = Record<string, Credential>;

export class PiCredentialStore implements CredentialStore {
  readonly #path: string;
  readonly #lockPath: string;
  readonly #chains = new Map<string, Promise<unknown>>();

  constructor(path = defaultCredentialPath()) {
    this.#path = path;
    this.#lockPath = `${path}.lock`;
  }

  async read(providerId: string): Promise<Credential | undefined> {
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
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
  ): Promise<Credential | undefined> {
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

function defaultCredentialPath() {
  const base =
    process.env.PI_CODING_AGENT_DIR ??
    join(process.env.HOME ?? process.cwd(), ".pi", "agent");
  return join(base, "auth.json");
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
