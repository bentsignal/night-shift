import { spawn } from "node:child_process";

import { getLocalConvexUrl, repositoryRoot } from "./local-environment.mjs";

const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const worker = spawn(packageManager, ["--filter", "@code/worker", "start"], {
  cwd: repositoryRoot,
  env: {
    ...process.env,
    CODE_OWNER_ID: process.env.CODE_OWNER_ID ?? "personal",
    CONVEX_URL: await getLocalConvexUrl(),
  },
  stdio: "inherit",
});
let closing = false;

worker.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
worker.on("exit", (code) => {
  process.exitCode = closing ? 0 : (code ?? 1);
});

function close() {
  closing = true;
  worker.kill("SIGTERM");
}

process.on("SIGINT", close);
process.on("SIGTERM", close);
