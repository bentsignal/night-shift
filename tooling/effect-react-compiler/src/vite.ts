import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

import type {
  EffectReactAnalysis,
  EffectReactDiagnostic,
  EffectReactRoot,
} from "./types.js";
import { analyzeEffectReact } from "./analyzer.js";
import { lowerEffectReactSources } from "./lowering.js";

export const effectReactAnalysisModuleId = "virtual:effect-react-analysis";
const resolvedAnalysisModuleId = `\0${effectReactAnalysisModuleId}`;
const sourcePattern = /\.[jt]sx?$/u;
const ignoredDirectories = new Set([
  ".git",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);

export interface EffectReactCompilerPluginOptions {
  readonly failOnDiagnostics?: boolean;
  readonly roots?: readonly EffectReactRoot[];
  readonly scanRoots?: readonly string[];
  readonly transformUnscanned?: boolean;
}

export function effectReactCompiler(
  options: EffectReactCompilerPluginOptions = {},
) {
  const sources = new Map<string, string>();
  let viteRoot = process.cwd();
  let latestAnalysis = analyzeEffectReact({ sources: [] });

  const analyze = () => {
    latestAnalysis = analyzeEffectReact({
      roots: options.roots,
      sources: [...sources].map(([fileName, source]) => ({
        fileName,
        source,
      })),
    });
    return latestAnalysis;
  };

  return {
    name: "@night-shift/effect-react-compiler",
    enforce: "pre",

    configResolved(config) {
      viteRoot = config.root;
    },

    async buildStart() {
      sources.clear();
      const scanRoots = options.scanRoots?.length
        ? options.scanRoots
        : [viteRoot];

      for (const scanRoot of scanRoots) {
        await scanSourcePath({
          sourcePath: path.resolve(viteRoot, scanRoot),
          sources,
        });
      }

      const analysis = analyze();
      if (options.failOnDiagnostics !== false && analysis.hasErrors) {
        this.error(formatEffectReactDiagnostics(analysis.diagnostics));
      }
    },

    transform(source, id) {
      const fileName = stripViteQuery(id);
      if (
        isAnalyzableSource(fileName) &&
        !fileName.includes(`${path.sep}node_modules${path.sep}`)
      ) {
        const resolvedFileName = path.resolve(fileName);
        if (!sources.has(resolvedFileName) && !options.transformUnscanned) {
          return null;
        }
        if (sources.has(resolvedFileName)) {
          sources.set(resolvedFileName, source);
        }
        const lowered = lowerEffectReactSources(
          sources.has(resolvedFileName)
            ? [...sources].map(([sourceFileName, sourceText]) => ({
                fileName: sourceFileName,
                source: sourceText,
              }))
            : [{ fileName: resolvedFileName, source }],
        ).get(resolvedFileName);
        if (lowered && lowered.insertions.length > 0) {
          return {
            code: lowered.source,
            map: null,
          };
        }
      }
      return null;
    },

    resolveId(id) {
      return id === effectReactAnalysisModuleId
        ? resolvedAnalysisModuleId
        : null;
    },

    load(id) {
      if (id !== resolvedAnalysisModuleId) {
        return null;
      }
      return createAnalysisModule(analyze());
    },

    async handleHotUpdate(context) {
      if (!isAnalyzableSource(context.file)) {
        return;
      }

      sources.set(path.resolve(context.file), await context.read());
      const analysisModule = context.server.moduleGraph.getModuleById(
        resolvedAnalysisModuleId,
      );
      if (analysisModule) {
        context.server.moduleGraph.invalidateModule(analysisModule);
      }
    },

    api: {
      analyze,
    },
  } satisfies Plugin & {
    readonly api: {
      readonly analyze: () => EffectReactAnalysis;
    };
  };
}

export const effectReact = effectReactCompiler;

export function createAnalysisModule(analysis: EffectReactAnalysis) {
  const serialized = JSON.stringify(analysis).replaceAll("<", "\\u003c");
  return `export const analysis = ${serialized};\nexport default analysis;\n`;
}

export function formatEffectReactDiagnostics(
  diagnostics: readonly EffectReactDiagnostic[],
) {
  return [
    "Effect React requirement analysis failed:",
    ...diagnostics.map(
      (diagnostic) =>
        `${diagnostic.fileName}:${diagnostic.location.line}:${diagnostic.location.column} [${diagnostic.code}] ${diagnostic.message}`,
    ),
  ].join("\n");
}

async function scanSourcePath({
  sourcePath,
  sources,
}: {
  readonly sourcePath: string;
  readonly sources: Map<string, string>;
}) {
  const sourceStats = await stat(sourcePath);
  if (sourceStats.isFile()) {
    if (isAnalyzableSource(sourcePath)) {
      sources.set(path.resolve(sourcePath), await readFile(sourcePath, "utf8"));
    }
    return;
  }

  const entries = await readdir(sourcePath, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const fileName = path.join(sourcePath, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          await scanSourcePath({ sourcePath: fileName, sources });
        }
        return;
      }

      if (entry.isFile() && isAnalyzableSource(fileName)) {
        sources.set(path.resolve(fileName), await readFile(fileName, "utf8"));
      }
    }),
  );
}

function isAnalyzableSource(fileName: string) {
  return sourcePattern.test(fileName) && !fileName.endsWith(".d.ts");
}

function stripViteQuery(id: string) {
  return id.split("?", 1)[0] ?? id;
}
