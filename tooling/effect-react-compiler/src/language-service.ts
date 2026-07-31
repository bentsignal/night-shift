import path from "node:path";
import type ts from "typescript";

import type { LoweredEffectReactSource, SourceInsertion } from "./lowering.js";
import {
  loweredToOriginalPosition,
  lowerEffectReactSources,
  originalToLoweredPosition,
} from "./lowering.js";

export function createEffectReactLanguageService({
  languageService,
  languageServiceHost,
  typescript,
}: {
  readonly languageService: ts.LanguageService;
  readonly languageServiceHost: ts.LanguageServiceHost;
  readonly typescript: typeof ts;
}) {
  const loweredProject = createLoweredProject({
    host: languageServiceHost,
    typescript,
  });
  const loweredHost = new Proxy(languageServiceHost, {
    get(target, property) {
      if (property === "setCompilerHost" || property === "updateFromProject") {
        return undefined;
      }
      if (property === "getScriptSnapshot") {
        return (fileName: string) => {
          const lowered = loweredProject.get(fileName);
          return lowered
            ? typescript.ScriptSnapshot.fromString(lowered.source)
            : target.getScriptSnapshot(fileName);
        };
      }
      if (property === "getScriptVersion") {
        return (fileName: string) =>
          loweredProject.scriptVersion(fileName) ??
          target.getScriptVersion(fileName);
      }
      if (property === "getProjectVersion") {
        return () => loweredProject.version();
      }

      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const loweredService = typescript.createLanguageService(
    loweredHost,
    typescript.createDocumentRegistry(),
  );
  const overrides = {
    getQuickInfoAtPosition(fileName, position, maximumLength) {
      const lowered = loweredProject.get(fileName);
      const quickInfo = loweredService.getQuickInfoAtPosition(
        fileName,
        lowered
          ? originalToLoweredPosition(position, lowered.insertions)
          : position,
        maximumLength,
      );
      return quickInfo && lowered
        ? {
            ...quickInfo,
            textSpan: mapTextSpanToOriginal(
              quickInfo.textSpan,
              lowered.insertions,
            ),
          }
        : quickInfo;
    },
    getSemanticDiagnostics(fileName) {
      return loweredService.getSemanticDiagnostics(fileName).map((diagnostic) =>
        mapDiagnosticToOriginal({
          diagnostic,
          loweredProject,
          originalProgram: languageService.getProgram(),
        }),
      );
    },
  } satisfies Partial<ts.LanguageService>;
  const proxy = new Proxy(languageService, {
    get(target, property) {
      const override = Reflect.get(overrides, property, overrides) as unknown;
      if (override !== undefined) {
        return override;
      }

      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  return proxy;
}

function createLoweredProject({
  host,
  typescript,
}: {
  readonly host: ts.LanguageServiceHost;
  readonly typescript: typeof ts;
}) {
  let cacheKey = "";
  let lowered = new Map<string, LoweredEffectReactSource>();
  let scriptVersions = new Map<string, number>();

  const refresh = () => {
    const fileNames = host
      .getScriptFileNames()
      .filter((fileName) => isEffectReactSource(fileName));
    const authoredVersions = fileNames
      .map((fileName) => `${fileName}:${host.getScriptVersion(fileName)}`)
      .join("|");
    const nextCacheKey = `${host.getProjectVersion?.() ?? ""}|${authoredVersions}`;
    if (nextCacheKey === cacheKey) {
      return;
    }

    const nextLowered = lowerEffectReactSources(
      fileNames.flatMap((fileName) => {
        const snapshot = host.getScriptSnapshot(fileName);
        return snapshot
          ? [
              {
                fileName,
                source: snapshot.getText(0, snapshot.getLength()),
              },
            ]
          : [];
      }),
    );
    const nextScriptVersions = new Map(scriptVersions);
    for (const [fileName, source] of nextLowered) {
      const previous = lowered.get(fileName);
      const previousVersion = scriptVersions.get(fileName) ?? 0;
      nextScriptVersions.set(
        fileName,
        previous?.source === source.source
          ? previousVersion
          : previousVersion + 1,
      );
    }

    lowered = nextLowered;
    scriptVersions = nextScriptVersions;
    cacheKey = nextCacheKey;
  };

  return {
    get(fileName: string) {
      refresh();
      return lowered.get(path.resolve(fileName));
    },
    getOriginalSourceFile(fileName: string) {
      const snapshot = host.getScriptSnapshot(fileName);
      if (!snapshot) {
        return undefined;
      }
      return typescript.createSourceFile(
        fileName,
        snapshot.getText(0, snapshot.getLength()),
        typescript.ScriptTarget.Latest,
        true,
        fileName.endsWith("x")
          ? typescript.ScriptKind.TSX
          : typescript.ScriptKind.TS,
      );
    },
    scriptVersion(fileName: string) {
      refresh();
      const version = scriptVersions.get(path.resolve(fileName));
      return version === undefined ? undefined : String(version);
    },
    version() {
      refresh();
      return cacheKey;
    },
  };
}

function mapDiagnosticToOriginal({
  diagnostic,
  loweredProject,
  originalProgram,
}: {
  readonly diagnostic: ts.Diagnostic;
  readonly loweredProject: ReturnType<typeof createLoweredProject>;
  readonly originalProgram: ts.Program | undefined;
}) {
  if (!diagnostic.file) {
    return diagnostic;
  }

  const lowered = loweredProject.get(diagnostic.file.fileName);
  if (!lowered) {
    return diagnostic;
  }

  const start =
    diagnostic.start === undefined
      ? undefined
      : loweredToOriginalPosition(diagnostic.start, lowered.insertions);
  const end =
    diagnostic.start === undefined
      ? undefined
      : loweredToOriginalPosition(
          diagnostic.start + (diagnostic.length ?? 0),
          lowered.insertions,
        );
  const file =
    originalProgram?.getSourceFile(diagnostic.file.fileName) ??
    loweredProject.getOriginalSourceFile(diagnostic.file.fileName);

  return {
    ...diagnostic,
    file,
    length:
      start === undefined || end === undefined
        ? diagnostic.length
        : end - start,
    relatedInformation: diagnostic.relatedInformation?.map(
      (relatedDiagnostic) =>
        mapRelatedDiagnosticToOriginal({
          diagnostic: relatedDiagnostic,
          loweredProject,
          originalProgram,
        }),
    ),
    start,
  };
}

function mapRelatedDiagnosticToOriginal({
  diagnostic,
  loweredProject,
  originalProgram,
}: {
  readonly diagnostic: ts.DiagnosticRelatedInformation;
  readonly loweredProject: ReturnType<typeof createLoweredProject>;
  readonly originalProgram: ts.Program | undefined;
}) {
  if (!diagnostic.file) {
    return diagnostic;
  }
  const lowered = loweredProject.get(diagnostic.file.fileName);
  if (!lowered || diagnostic.start === undefined) {
    return diagnostic;
  }

  const start = loweredToOriginalPosition(diagnostic.start, lowered.insertions);
  const end = loweredToOriginalPosition(
    diagnostic.start + (diagnostic.length ?? 0),
    lowered.insertions,
  );
  return {
    ...diagnostic,
    file:
      originalProgram?.getSourceFile(diagnostic.file.fileName) ??
      loweredProject.getOriginalSourceFile(diagnostic.file.fileName),
    length: end - start,
    start,
  };
}

function mapTextSpanToOriginal(
  textSpan: ts.TextSpan,
  insertions: readonly SourceInsertion[],
) {
  const start = loweredToOriginalPosition(textSpan.start, insertions);
  const end = loweredToOriginalPosition(
    textSpan.start + textSpan.length,
    insertions,
  );
  return { length: end - start, start };
}

function isEffectReactSource(fileName: string) {
  return /\.[jt]sx?$/u.test(fileName) && !fileName.endsWith(".d.ts");
}
