import { spawn } from "node:child_process";
import { Data } from "effect";

import type {
  ReasoningLevel,
  RuntimeAdapter,
  RuntimeInput,
  RuntimeMilestone,
  RuntimeResult,
  RuntimeSelection,
} from "./types.ts";

const MAX_SUMMARY_CHARACTERS = 2_000;
const MAX_ERROR_CHARACTERS = 4_000;

export type CodexSandbox =
  "read-only" | "workspace-write" | "danger-full-access";

export interface CodexCliRuntimeOptions {
  command?: string;
  sandbox?: CodexSandbox;
  environment?: NodeJS.ProcessEnv;
}

export class CodexCliExecutionError extends Data.TaggedError(
  "CodexCliExecutionError",
)<{
  readonly exitCode: number | null;
  readonly details: string;
}> {
  override get message(): string {
    const suffix = this.details ? `: ${this.details}` : "";
    return `Codex CLI exited with code ${String(this.exitCode)}${suffix}`;
  }
}

/**
 * Runs the user's installed Codex CLI and therefore reuses its host-local
 * ChatGPT subscription login. Convex receives checkpoints and summaries, never
 * credentials or the high-volume JSONL event stream.
 */
export class CodexCliRuntime implements RuntimeAdapter {
  readonly #command: string;
  readonly #sandbox: CodexSandbox;
  readonly #environment: NodeJS.ProcessEnv;

  constructor(options: CodexCliRuntimeOptions = {}) {
    this.#command = options.command ?? "codex";
    this.#sandbox = options.sandbox ?? "workspace-write";
    this.#environment = options.environment ?? process.env;
  }

  execute(
    input: RuntimeInput,
    selection: RuntimeSelection,
    signal: AbortSignal,
    emit: (milestone: RuntimeMilestone) => Promise<void>,
  ): Promise<RuntimeResult> {
    const arguments_ = buildCodexArguments(
      input.projectPath,
      selection,
      this.#sandbox,
    );
    const prompt = `${input.systemPrompt}\n\nNight Shift assignment:\n${input.prompt}`;

    return new Promise((resolve, reject) => {
      const child = spawn(this.#command, arguments_, {
        cwd: input.projectPath,
        env: this.#environment,
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdoutBuffer = "";
      let stderr = "";
      let summary = "Codex completed the assignment.";
      let threadId: string | undefined;
      let settled = false;
      const milestones = new Array<Promise<void>>();

      const abort = () => child.kill("SIGTERM");
      signal.addEventListener("abort", abort, { once: true });

      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdoutBuffer += chunk;
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop() ?? "";
        for (const line of lines) {
          const event = parseCodexEvent(line);
          if (event.threadId && event.threadId !== threadId) {
            threadId = event.threadId;
            milestones.push(
              emit({
                kind: "checkpoint",
                operationId: `${input.attemptId}:codex-thread:${threadId}`,
                summary: `Codex started host-local thread ${threadId}.`,
              }),
            );
          }
          if (event.summary) summary = event.summary;
        }
      });
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderr = `${stderr}${chunk}`.slice(-MAX_ERROR_CHARACTERS);
      });
      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", abort);
        reject(
          new CodexCliExecutionError({
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
          reject(signal.reason ?? new Error("Codex CLI execution was aborted"));
          return;
        }
        void Promise.all(milestones).then(() => {
          if (exitCode === 0) {
            resolve({ summary });
            return;
          }
          reject(
            new CodexCliExecutionError({
              exitCode,
              details: stderr.trim(),
            }),
          );
        }, reject);
      });

      child.stdin.end(prompt);
    });
  }
}

export function buildCodexArguments(
  projectPath: string,
  selection: RuntimeSelection,
  sandbox: CodexSandbox,
) {
  const arguments_ = [
    "exec",
    "--json",
    "--color",
    "never",
    "--sandbox",
    sandbox,
    "--cd",
    projectPath,
  ];
  if (selection.model && selection.model !== "default") {
    arguments_.push("--model", selection.model);
  }
  arguments_.push(
    "--config",
    `model_reasoning_effort=${JSON.stringify(codexReasoning(selection.reasoning))}`,
    "-",
  );
  return arguments_;
}

export function parseCodexEvent(line: string) {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return {};
  }
  if (!isRecord(value)) return {};
  if (value.type === "thread.started" && typeof value.thread_id === "string") {
    return { threadId: value.thread_id };
  }
  if (value.type !== "item.completed" || !isRecord(value.item)) return {};
  if (
    value.item.type === "agent_message" &&
    typeof value.item.text === "string"
  ) {
    return { summary: value.item.text.trim().slice(-MAX_SUMMARY_CHARACTERS) };
  }
  return {};
}

function codexReasoning(reasoning: ReasoningLevel) {
  if (reasoning === "off" || reasoning === "minimal") return "low";
  if (reasoning === "max") return "xhigh";
  return reasoning;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
