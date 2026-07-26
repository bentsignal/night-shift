import { spawn } from "node:child_process";

import type { ValidationResult, Validator } from "./types.ts";

export class CommandValidator implements Validator {
  readonly #command: string;
  readonly #args: string[];

  constructor(command = "git", args = ["diff", "--check"]) {
    this.#command = command;
    this.#args = args;
  }

  async validate(
    projectPath: string,
    signal: AbortSignal,
  ): Promise<ValidationResult> {
    const startedAt = Date.now();
    const result = await new Promise<{ exitCode: number; output: string }>(
      (resolve, reject) => {
        const child = spawn(this.#command, this.#args, {
          cwd: projectPath,
          detached: process.platform !== "win32",
          signal,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let output = "";
        const append = (chunk: Buffer) => {
          output = `${output}${chunk.toString()}`.slice(-4_000);
        };
        child.stdout.on("data", append);
        child.stderr.on("data", append);
        child.on("error", reject);
        child.on("close", (code) => {
          resolve({ exitCode: code ?? 1, output: output.trim() });
        });
      },
    );

    return {
      name: `${this.#command} ${this.#args.join(" ")}`,
      status: result.exitCode === 0 ? "passed" : "failed",
      exitCode: result.exitCode,
      durationMs: Date.now() - startedAt,
      summary:
        result.output ||
        (result.exitCode === 0
          ? "Deterministic validation passed."
          : "Deterministic validation failed."),
    };
  }
}
