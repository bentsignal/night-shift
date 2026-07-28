import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Response } from "@effect/ai";
import { LanguageModel } from "@effect/ai";
import { Effect, Stream } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ModelResolverService } from "./runtime-services.ts";
import { EffectRuntimeAdapter } from "./effect-runtime.ts";
import { deterministicModelResolver } from "./fake-language-model.ts";
import { Workspace, workspaceLayer } from "./tools.ts";

const temporaryDirectories = new Array<string>();

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("EffectRuntimeAdapter", () => {
  it("executes a deterministic model and publishes one sparse checkpoint", async () => {
    const directory = await temporaryDirectory();
    const emit = vi.fn(async () => undefined);
    const adapter = new EffectRuntimeAdapter(
      deterministicModelResolver("A deterministic local result."),
    );

    const result = await adapter.execute(
      runtimeInput(directory),
      runtimeSelection(),
      new AbortController().signal,
      emit,
    );

    expect(result.summary).toBe("A deterministic local result.");
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith({
      kind: "checkpoint",
      operationId: "attempt-1:turn:1",
      summary: "A deterministic local result.",
    });
  });

  it("continues after a typed tool call and writes only inside the project", async () => {
    const directory = await temporaryDirectory();
    const outputPath = join(directory, "result.txt");
    let calls = 0;
    const resolver = fakeResolver(() => {
      calls += 1;
      if (calls === 1) {
        return [
          {
            type: "tool-call",
            id: "write-1",
            name: "write_text_file",
            params: {
              path: "result.txt",
              contents: "written by the Effect harness\n",
            },
          },
        ];
      }
      return textStream("Finished after writing the file.");
    });
    const emit = vi.fn(async () => undefined);
    const adapter = new EffectRuntimeAdapter(resolver);

    const result = await adapter.execute(
      runtimeInput(directory),
      runtimeSelection(),
      new AbortController().signal,
      emit,
    );

    await expect(readFile(outputPath, "utf8")).resolves.toBe(
      "written by the Effect harness\n",
    );
    expect(calls).toBe(2);
    expect(result.summary).toBe("Finished after writing the file.");
    expect(emit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        operationId: "attempt-1:turn:1",
        summary: "Executed write_text_file; continuing.",
      }),
    );
    expect(emit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        operationId: "attempt-1:turn:2",
      }),
    );
  });

  it("interrupts a model stream through the daemon AbortSignal boundary", async () => {
    const directory = await temporaryDirectory();
    const resolver = {
      resolve: () =>
        LanguageModel.make({
          generateText: () => Effect.succeed([]),
          streamText: () => Stream.never,
        }),
    } satisfies ModelResolverService;
    const controller = new AbortController();
    const adapter = new EffectRuntimeAdapter(resolver);
    const execution = adapter.execute(
      runtimeInput(directory),
      runtimeSelection(),
      controller.signal,
      vi.fn(async () => undefined),
    );

    controller.abort(new Error("authority lost"));

    await expect(execution).rejects.toBeDefined();
  });

  it("fails closed when the model exceeds the bounded turn limit", async () => {
    const directory = await temporaryDirectory();
    let callId = 0;
    const resolver = fakeResolver(() => {
      callId += 1;
      return [
        {
          type: "tool-call",
          id: `list-${callId}`,
          name: "list_files",
          params: { path: "." },
        },
      ];
    });
    const adapter = new EffectRuntimeAdapter(resolver, { maxTurns: 2 });

    await expect(
      adapter.execute(
        runtimeInput(directory),
        runtimeSelection(),
        new AbortController().signal,
        vi.fn(async () => undefined),
      ),
    ).rejects.toThrow(/exceeded the 2-turn execution limit/);
  });
});

describe("Workspace", () => {
  it("rejects lexical paths outside the assigned project", async () => {
    const directory = await temporaryDirectory();
    const result = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const workspace = yield* Workspace;
        return yield* workspace.read("../outside.txt");
      }).pipe(Effect.provide(workspaceLayer(directory))),
    );

    expect(result._tag).toBe("Failure");
    expect(String(result)).toContain("Tool path escapes");
  });
});

function fakeResolver(response: () => Array<Response.StreamPartEncoded>) {
  return {
    resolve: () =>
      LanguageModel.make({
        generateText: () => Effect.succeed([]),
        streamText: () => Stream.fromIterable(response()),
      }),
  } satisfies ModelResolverService;
}

function textStream(text: string) {
  return [
    { type: "text-start", id: "text-1" },
    { type: "text-delta", id: "text-1", delta: text },
    { type: "text-end", id: "text-1" },
  ] satisfies Array<Response.StreamPartEncoded>;
}

function runtimeInput(projectPath: string) {
  return {
    attemptId: "attempt-1",
    prompt: "Complete the slice",
    projectPath,
    systemPrompt: "Test system prompt",
  };
}

function runtimeSelection() {
  return {
    provider: "faux",
    model: "control",
    reasoning: "high" as const,
  };
}

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "night-shift-effect-worker-"));
  temporaryDirectories.push(directory);
  return directory;
}
