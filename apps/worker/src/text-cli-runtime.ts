import { spawn } from "node:child_process";
import { Data } from "effect";

import type {
  RuntimeAdapter,
  RuntimeInput,
  RuntimeMilestone,
  RuntimeResult,
  RuntimeSelection,
} from "./types.ts";

const MAX_OUTPUT_CHARACTERS = 4_000;

export interface TextCliRuntimeOptions {
  adapter: string;
  displayName: string;
  command: string;
  buildArguments: (
    input: RuntimeInput,
    selection: RuntimeSelection,
  ) => string[];
  environment?: NodeJS.ProcessEnv;
}

export class TextCliExecutionError extends Data.TaggedError(
  "TextCliExecutionError",
)<{
  readonly adapter: string;
  readonly exitCode: number | null;
  readonly details: string;
}> {
  override get message(): string {
    return `${this.adapter} exited with code ${String(this.exitCode)}${this.details ? `: ${this.details}` : ""}`;
  }
}

/**
 * Narrow adapter for external harnesses with a noninteractive text mode. The
 * harness owns its local session/auth format; Night Shift owns assignment,
 * cancellation, validation, and durable state.
 */
export class TextCliRuntime implements RuntimeAdapter {
  readonly #options: TextCliRuntimeOptions;

  constructor(options: TextCliRuntimeOptions) {
    this.#options = options;
  }

  async execute(
    input: RuntimeInput,
    selection: RuntimeSelection,
    signal: AbortSignal,
    emit: (milestone: RuntimeMilestone) => Promise<void>,
  ): Promise<RuntimeResult> {
    await emit({
      kind: "checkpoint",
      operationId: `${input.attemptId}:${this.#options.adapter}:started`,
      summary: `${this.#options.displayName} started on the enrolled host.`,
    });
    return await new Promise((resolve, reject) => {
      const child = spawn(
        this.#options.command,
        this.#options.buildArguments(input, selection),
        {
          cwd: input.projectPath,
          env: this.#options.environment ?? process.env,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let stdout = "";
      let stderr = "";
      let settled = false;
      const abort = () => child.kill("SIGTERM");
      signal.addEventListener("abort", abort, { once: true });
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout = `${stdout}${chunk}`.slice(-MAX_OUTPUT_CHARACTERS);
      });
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderr = `${stderr}${chunk}`.slice(-MAX_OUTPUT_CHARACTERS);
      });
      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", abort);
        reject(
          new TextCliExecutionError({
            adapter: this.#options.adapter,
            exitCode: null,
            details: error.message,
          }),
        );
      });
      child.on("close", (exitCode) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", abort);
        if (signal.aborted) {
          reject(signal.reason ?? new Error("Harness execution was aborted"));
          return;
        }
        const summary = stdout.trim();
        if (exitCode === 0 && summary) {
          resolve({ summary });
          return;
        }
        reject(
          new TextCliExecutionError({
            adapter: this.#options.adapter,
            exitCode,
            details: (
              stderr ||
              stdout ||
              "Harness returned no final answer"
            ).trim(),
          }),
        );
      });
    });
  }
}

export function makePiRuntime(environment: NodeJS.ProcessEnv = process.env) {
  return new TextCliRuntime({
    adapter: "pi",
    displayName: "Pi",
    command: environment.NIGHT_SHIFT_PI_COMMAND ?? "pi",
    environment,
    buildArguments: (input, selection) => [
      "--print",
      "--mode",
      "text",
      "--provider",
      selection.provider,
      "--model",
      selection.model,
      "--thinking",
      selection.reasoning,
      "--no-session",
      "--no-extensions",
      "--no-skills",
      "--no-context-files",
      "--approve",
      "--append-system-prompt",
      input.systemPrompt,
      "--tools",
      environment.NIGHT_SHIFT_PI_TOOLS ?? "read,grep,find,ls",
      input.prompt,
    ],
  });
}

export function makeClaudeRuntime(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return new TextCliRuntime({
    adapter: "claude-code",
    displayName: "Claude Code",
    command: environment.NIGHT_SHIFT_CLAUDE_COMMAND ?? "claude",
    environment,
    buildArguments: (input, selection) => [
      "--print",
      "--output-format",
      "text",
      "--permission-mode",
      environment.NIGHT_SHIFT_CLAUDE_PERMISSION_MODE ?? "plan",
      "--effort",
      claudeEffort(selection.reasoning),
      "--model",
      selection.model,
      "--append-system-prompt",
      input.systemPrompt,
      "--no-session-persistence",
      "--safe-mode",
      input.prompt,
    ],
  });
}

function claudeEffort(reasoning: RuntimeSelection["reasoning"]) {
  return reasoning === "off" || reasoning === "minimal" ? "low" : reasoning;
}
