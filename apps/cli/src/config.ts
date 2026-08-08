import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

export interface NightShiftClientConfig {
  url: string;
  ownerId: string;
}

interface StoredConfig {
  convexUrl?: string;
  ownerId?: string;
}

export async function loadClientConfig(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const stored = await readStoredConfig(environment);
  const local = await readEnvironmentFile(
    resolve(import.meta.dirname, "../../../services/convex/.env.local"),
  );
  const url =
    environment.NIGHT_SHIFT_CONVEX_URL ??
    environment.CONVEX_URL ??
    stored.convexUrl ??
    local.CONVEX_URL;
  if (!url) {
    throw new Error(
      "no Convex authority is configured; set NIGHT_SHIFT_CONVEX_URL or add convexUrl to ~/.night-shift/config.json",
    );
  }
  return {
    url,
    ownerId: environment.NIGHT_SHIFT_OWNER_ID ?? stored.ownerId ?? "personal",
  };
}

async function readStoredConfig(environment: NodeJS.ProcessEnv) {
  const path =
    environment.NIGHT_SHIFT_CONFIG ??
    resolve(environment.HOME ?? homedir(), ".night-shift/config.json");
  try {
    return JSON.parse(await readFile(path, "utf8")) as StoredConfig;
  } catch (error) {
    if (isNotFound(error)) return {};
    if (error instanceof SyntaxError) {
      throw new Error(`Night Shift config is not valid JSON: ${path}`);
    }
    throw error;
  }
}

async function readEnvironmentFile(path: string) {
  try {
    const contents = await readFile(path, "utf8");
    return Object.fromEntries(
      contents
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const separator = line.indexOf("=");
          if (separator === -1) return [line, ""];
          return [
            line.slice(0, separator),
            line.slice(separator + 1).replace(/^(['"])(.*)\1$/, "$2"),
          ];
        }),
    );
  } catch (error) {
    if (isNotFound(error)) return {};
    throw error;
  }
}

function isNotFound(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
