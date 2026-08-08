#!/usr/bin/env node
import { Effect } from "effect";

import { loadClientConfig } from "./config.ts";
import { respondToRequest } from "./conversation.ts";
import { ConvexNightShiftClient } from "./convex-client.ts";

const request = await readConversationalRequest(
  process.argv.slice(2).filter((argument) => argument !== "--"),
);

if (!request || request === "--help" || request === "-h") {
  console.log(helpText());
  process.exitCode = request ? 0 : 1;
} else {
  const program = Effect.tryPromise({
    try: async () => {
      const config = await loadClientConfig();
      const client = new ConvexNightShiftClient(config);
      return await respondToRequest(request, client, {
        cwd:
          process.env.NIGHT_SHIFT_PROJECT_PATH ??
          process.env.INIT_CWD ??
          process.cwd(),
        environment: process.env,
      });
    },
    catch: (error) =>
      error instanceof Error ? error : new Error(String(error)),
  });

  try {
    console.log(await Effect.runPromise(program));
  } catch (error) {
    console.error(
      `Night Shift could not complete that request: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

async function readConversationalRequest(arguments_: ReadonlyArray<string>) {
  const argumentRequest = arguments_.join(" ").trim();
  if (argumentRequest) return argumentRequest;
  if (process.stdin.isTTY) return "";
  let standardInput = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) standardInput += chunk;
  return standardInput.trim();
}

function helpText() {
  return `night-shift

Talk to Night Shift in natural language:
  night-shift "What finished overnight?"
  night-shift "What needs my attention?"
  night-shift "Use Codex to update this project and run its tests."
  night-shift "Pause run <run-id>."

New work targets the current directory. Set NIGHT_SHIFT_CONVEX_URL and
NIGHT_SHIFT_OWNER_ID, or place the authority URL in ~/.night-shift/config.json.`;
}
