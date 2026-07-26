import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const repositoryRoot = resolve(import.meta.dirname, "..");

async function readEnvironmentFile(path) {
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
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function getLocalConvexUrl(environment = process.env) {
  const convexEnvironment = await readEnvironmentFile(
    resolve(repositoryRoot, "services/convex/.env.local"),
  );
  return (
    environment.CONVEX_URL ??
    environment.VITE_CONVEX_URL ??
    convexEnvironment.CONVEX_URL ??
    "http://127.0.0.1:3210"
  );
}
