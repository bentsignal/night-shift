import { randomUUID } from "node:crypto";
import {
  readdir,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { Tool, Toolkit } from "@effect/ai";
import { Context, Effect, Layer, Schema } from "effect";

const MAX_READ_CHARACTERS = 40_000;
const MAX_LIST_ENTRIES = 1_000;

interface WorkspaceService {
  read(path: string): Effect.Effect<
    {
      path: string;
      contents: string;
      truncated: boolean;
    },
    WorkspaceToolError
  >;
  write(
    path: string,
    contents: string,
  ): Effect.Effect<{ path: string; bytes: number }, WorkspaceToolError>;
  list(path: string): Effect.Effect<
    {
      path: string;
      entries: Array<{
        name: string;
        type: "file" | "directory" | "other";
      }>;
      truncated: boolean;
    },
    WorkspaceToolError
  >;
}

export class Workspace extends Context.Tag("@code/worker/Workspace")<
  Workspace,
  WorkspaceService
>() {}

export class WorkspaceToolError extends Schema.TaggedError<WorkspaceToolError>()(
  "WorkspaceToolError",
  {
    operation: Schema.Literal("read", "write", "list"),
    path: Schema.String,
    message: Schema.String,
  },
) {}

const FileEntry = Schema.Struct({
  name: Schema.String,
  type: Schema.Literal("file", "directory", "other"),
});

export const ReadTextFile = Tool.make("read_text_file", {
  description: "Read a UTF-8 text file inside the assigned project.",
  parameters: {
    path: Schema.String.annotations({
      description: "Project-relative path to read.",
    }),
  },
  success: Schema.Struct({
    path: Schema.String,
    contents: Schema.String,
    truncated: Schema.Boolean,
  }),
  failure: WorkspaceToolError,
  failureMode: "return",
  dependencies: [Workspace],
});

export const WriteTextFile = Tool.make("write_text_file", {
  description:
    "Atomically replace a UTF-8 text file inside the assigned project.",
  parameters: {
    path: Schema.String.annotations({
      description: "Project-relative path to write.",
    }),
    contents: Schema.String.annotations({
      description: "Complete replacement contents.",
    }),
  },
  success: Schema.Struct({
    path: Schema.String,
    bytes: Schema.Number,
  }),
  failure: WorkspaceToolError,
  failureMode: "return",
  dependencies: [Workspace],
});

export const ListFiles = Tool.make("list_files", {
  description: "List one directory inside the assigned project.",
  parameters: {
    path: Schema.String.annotations({
      description: "Project-relative directory, or '.' for the project root.",
    }),
  },
  success: Schema.Struct({
    path: Schema.String,
    entries: Schema.Array(FileEntry),
    truncated: Schema.Boolean,
  }),
  failure: WorkspaceToolError,
  failureMode: "return",
  dependencies: [Workspace],
});

export const CodingToolkit = Toolkit.make(
  ReadTextFile,
  WriteTextFile,
  ListFiles,
);

export const CodingToolkitHandlers = CodingToolkit.toLayer({
  read_text_file: ({ path }) =>
    Effect.flatMap(Workspace, (workspace) => workspace.read(path)),
  write_text_file: ({ path, contents }) =>
    Effect.flatMap(Workspace, (workspace) => workspace.write(path, contents)),
  list_files: ({ path }) =>
    Effect.flatMap(Workspace, (workspace) => workspace.list(path)),
});

export function workspaceLayer(projectPath: string) {
  const root = resolve(projectPath);
  return Layer.succeed(Workspace, {
    read: (inputPath) =>
      Effect.tryPromise({
        try: async (signal) => {
          const target = await resolveExistingInside(root, inputPath);
          const contents = await readFile(target, {
            encoding: "utf8",
            signal,
          });
          return {
            path: inputPath,
            contents: contents.slice(0, MAX_READ_CHARACTERS),
            truncated: contents.length > MAX_READ_CHARACTERS,
          };
        },
        catch: workspaceError("read", inputPath),
      }),
    write: (inputPath, contents) =>
      Effect.tryPromise({
        try: async (signal) => {
          const target = lexicalPathInside(root, inputPath);
          const parent = await realpath(dirname(target));
          const canonicalRoot = await realpath(root);
          assertInside(canonicalRoot, parent);

          try {
            const existingTarget = await realpath(target);
            assertInside(canonicalRoot, existingTarget);
          } catch (error) {
            if (!isNotFound(error)) throw error;
          }

          const temporaryPath = resolve(
            parent,
            `.${randomUUID()}.code-write.tmp`,
          );
          try {
            await writeFile(temporaryPath, contents, {
              encoding: "utf8",
              signal,
            });
            signal.throwIfAborted();
            await rename(temporaryPath, target);
          } finally {
            await unlink(temporaryPath).catch(() => undefined);
          }
          return { path: inputPath, bytes: Buffer.byteLength(contents) };
        },
        catch: workspaceError("write", inputPath),
      }),
    list: (inputPath) =>
      Effect.tryPromise({
        try: async () => {
          const target = await resolveExistingInside(root, inputPath);
          const allEntries = await readdir(target, { withFileTypes: true });
          const entries = allEntries
            .slice(0, MAX_LIST_ENTRIES)
            .map((entry) => ({
              name: entry.name,
              type: entry.isFile()
                ? ("file" as const)
                : entry.isDirectory()
                  ? ("directory" as const)
                  : ("other" as const),
            }));
          return {
            path: inputPath,
            entries,
            truncated: allEntries.length > MAX_LIST_ENTRIES,
          };
        },
        catch: workspaceError("list", inputPath),
      }),
  });
}

async function resolveExistingInside(root: string, inputPath: string) {
  const target = lexicalPathInside(root, inputPath);
  const [canonicalRoot, canonicalTarget] = await Promise.all([
    realpath(root),
    realpath(target),
  ]);
  assertInside(canonicalRoot, canonicalTarget);
  return canonicalTarget;
}

function lexicalPathInside(root: string, inputPath: string) {
  if (isAbsolute(inputPath)) {
    throw new Error("Tool paths must be relative to the assigned project");
  }
  const target = resolve(root, inputPath);
  assertInside(root, target);
  return target;
}

function assertInside(root: string, target: string) {
  const fromRoot = relative(root, target);
  if (
    fromRoot === ".." ||
    fromRoot.startsWith(`..${sep}`) ||
    isAbsolute(fromRoot)
  ) {
    throw new Error("Tool path escapes the assigned project");
  }
}

function workspaceError(
  operation: WorkspaceToolError["operation"],
  path: string,
) {
  return (error: unknown) =>
    new WorkspaceToolError({
      operation,
      path,
      message: error instanceof Error ? error.message : String(error),
    });
}

function isNotFound(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
