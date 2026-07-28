import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";

export function createCodingTools(projectPath: string) {
  return [createReadTool(projectPath), createWriteTool(projectPath)];
}

function createReadTool(projectPath: string) {
  const parameters = Type.Object({
    path: Type.String({
      description: "Project-relative path to read.",
    }),
  });
  return {
    name: "read_text_file",
    label: "Read text file",
    description: "Read a UTF-8 text file inside the assigned project.",
    parameters,
    execute: async (_toolCallId, input, signal) => {
      const { path: inputPath } = input as { path: string };
      signal?.throwIfAborted();
      const path = resolveInside(projectPath, inputPath);
      const contents = await readFile(path, "utf8");
      signal?.throwIfAborted();
      return {
        content: [{ type: "text", text: contents.slice(0, 40_000) }],
        details: { path: inputPath, truncated: contents.length > 40_000 },
      };
    },
  } satisfies AgentTool;
}

function createWriteTool(projectPath: string) {
  const parameters = Type.Object({
    path: Type.String({
      description: "Project-relative path to write.",
    }),
    contents: Type.String({ description: "Complete replacement contents." }),
  });
  return {
    name: "write_text_file",
    label: "Write text file",
    description:
      "Write complete UTF-8 contents to a file inside the assigned project.",
    parameters,
    execute: async (_toolCallId, input, signal) => {
      const { path: inputPath, contents } = input as {
        path: string;
        contents: string;
      };
      signal?.throwIfAborted();
      const path = resolveInside(projectPath, inputPath);
      await writeFile(path, contents, { encoding: "utf8", signal });
      return {
        content: [{ type: "text", text: `Wrote ${inputPath}.` }],
        details: { path: inputPath, bytes: Buffer.byteLength(contents) },
      };
    },
  } satisfies AgentTool;
}

function resolveInside(projectPath: string, inputPath: string) {
  if (isAbsolute(inputPath)) {
    throw new Error("Tool paths must be relative to the assigned project");
  }
  const root = resolve(projectPath);
  const target = resolve(root, inputPath);
  const fromRoot = relative(root, target);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new Error("Tool path escapes the assigned project");
  }
  return target;
}
