import { spawn } from "node:child_process";

import { getLocalConvexUrl, repositoryRoot } from "./local-environment.mjs";

const convexUrl = await getLocalConvexUrl();
const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const sharedEnvironment = {
  ...process.env,
  VITE_CODE_OWNER_ID: process.env.VITE_CODE_OWNER_ID ?? "personal",
  VITE_CONVEX_URL: convexUrl,
};
const webOnly = process.argv.includes("--web-only");

const processes = [
  ...(webOnly
    ? []
    : [
        spawn(packageManager, ["--filter", "@code/convex", "dev"], {
          cwd: repositoryRoot,
          env: sharedEnvironment,
          stdio: "inherit",
        }),
      ]),
  spawn(packageManager, ["--filter", "@code/web", "dev"], {
    cwd: repositoryRoot,
    env: sharedEnvironment,
    stdio: "inherit",
  }),
];

let closing = false;

function close(exitCode = 0) {
  if (closing) return;
  closing = true;
  for (const child of processes) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exitCode = exitCode;
}

for (const child of processes) {
  child.on("error", (error) => {
    console.error(error);
    close(1);
  });
  child.on("exit", (code, signal) => {
    if (closing) return;
    if (signal === "SIGTERM" || signal === "SIGINT") {
      close(0);
      return;
    }
    close(code ?? 1);
  });
}

process.on("SIGINT", () => close(0));
process.on("SIGTERM", () => close(0));
