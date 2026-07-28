import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { getLocalConvexUrl, repositoryRoot } from "./local-environment.mjs";

const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const web = spawn(
  packageManager,
  ["exec", "vite", "dev", "--host", "0.0.0.0"],
  {
    cwd: resolve(repositoryRoot, "apps/web"),
    env: {
      ...process.env,
      VITE_CODE_OWNER_ID: process.env.VITE_CODE_OWNER_ID ?? "personal",
      VITE_CONVEX_URL: await getLocalConvexUrl(),
    },
    stdio: "inherit",
  },
);
let closing = false;

web.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
web.on("exit", (code) => {
  process.exitCode = closing ? 0 : (code ?? 1);
});

function close() {
  closing = true;
  web.kill("SIGTERM");
}

process.on("SIGINT", close);
process.on("SIGTERM", close);
