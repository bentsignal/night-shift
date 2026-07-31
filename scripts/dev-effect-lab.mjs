import { spawn } from "node:child_process";

const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const portless = spawn(packageManager, ["exec", "portless", "run", "--force"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORTLESS_FUNNEL: "0",
    PORTLESS_LAN: "1",
    PORTLESS_TAILSCALE: "0",
  },
  stdio: "inherit",
});

let closing = false;

portless.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
portless.on("exit", (code, signal) => {
  if (closing || signal === "SIGINT" || signal === "SIGTERM") {
    process.exitCode = 0;
    return;
  }
  process.exitCode = code ?? 1;
});

function close() {
  closing = true;
  portless.kill("SIGTERM");
}

process.on("SIGINT", close);
process.on("SIGTERM", close);
