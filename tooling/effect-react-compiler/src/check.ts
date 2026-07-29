#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import ts from "typescript";

import type { LoweredEffectReactSource } from "./lowering.js";
import {
  loweredToOriginalPosition,
  lowerEffectReactSources,
} from "./lowering.js";

const configFileName = findConfigFileName(process.argv.slice(2));
const config = ts.readConfigFile(configFileName, ts.sys.readFile);
if (config.error) {
  reportDiagnostics([config.error]);
  process.exitCode = 1;
} else {
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configFileName),
    { noEmit: true },
    configFileName,
  );
  const sourceFiles = parsed.fileNames.filter(
    (fileName) => !fileName.endsWith(".d.ts"),
  );
  const lowered = lowerEffectReactSources(
    sourceFiles.flatMap((fileName) => {
      const source = ts.sys.readFile(fileName);
      return source ? [{ fileName, source }] : [];
    }),
  );
  const host = createLoweredCompilerHost(parsed.options, lowered);
  const program = ts.createProgram({
    host,
    options: parsed.options,
    rootNames: parsed.fileNames,
  });
  const diagnostics = [
    ...parsed.errors,
    ...ts.getPreEmitDiagnostics(program),
  ].map((diagnostic) => mapDiagnosticToOriginal(diagnostic, lowered));

  if (diagnostics.length > 0) {
    reportDiagnostics(diagnostics);
    process.exitCode = 1;
  }
}

function createLoweredCompilerHost(
  options: ts.CompilerOptions,
  lowered: ReadonlyMap<string, LoweredEffectReactSource>,
) {
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);

  host.getSourceFile = (
    fileName,
    languageVersionOrOptions,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    const loweredSource = lowered.get(path.resolve(fileName));
    if (!loweredSource) {
      return getSourceFile(
        fileName,
        languageVersionOrOptions,
        onError,
        shouldCreateNewSourceFile,
      );
    }
    return ts.createSourceFile(
      fileName,
      loweredSource.source,
      languageVersionOrOptions,
      true,
      fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
  };

  return host;
}

function findConfigFileName(arguments_: readonly string[]) {
  const projectIndex = arguments_.findIndex(
    (argument) => argument === "--project" || argument === "-p",
  );
  const projectArgument =
    projectIndex === -1 ? undefined : arguments_[projectIndex + 1];
  const configFileName = projectArgument
    ? ts.findConfigFile(process.cwd(), ts.sys.fileExists, projectArgument)
    : ts.findConfigFile(process.cwd(), ts.sys.fileExists);

  if (!configFileName) {
    throw new Error(
      projectArgument
        ? `Cannot find TypeScript project "${projectArgument}".`
        : "Cannot find a tsconfig.json.",
    );
  }
  return configFileName;
}

function mapDiagnosticToOriginal(
  diagnostic: ts.Diagnostic,
  lowered: ReadonlyMap<string, LoweredEffectReactSource>,
) {
  if (!diagnostic.file) {
    return diagnostic;
  }
  const loweredSource = lowered.get(path.resolve(diagnostic.file.fileName));
  if (!loweredSource || diagnostic.start === undefined) {
    return diagnostic;
  }

  const source = ts.sys.readFile(diagnostic.file.fileName);
  const start = loweredToOriginalPosition(
    diagnostic.start,
    loweredSource.insertions,
  );
  const end = loweredToOriginalPosition(
    diagnostic.start + (diagnostic.length ?? 0),
    loweredSource.insertions,
  );
  return {
    ...diagnostic,
    file: source
      ? ts.createSourceFile(
          diagnostic.file.fileName,
          source,
          ts.ScriptTarget.Latest,
          true,
          diagnostic.file.fileName.endsWith("x")
            ? ts.ScriptKind.TSX
            : ts.ScriptKind.TS,
        )
      : diagnostic.file,
    length: end - start,
    start,
  };
}

function reportDiagnostics(diagnostics: readonly ts.Diagnostic[]) {
  process.stderr.write(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getNewLine: () => ts.sys.newLine,
    }),
  );
}
