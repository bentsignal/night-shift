import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createEffectReactLanguageService } from "../src";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const projectRoot = path.join(repositoryRoot, "apps/effect-lab");
const configFileName = path.join(projectRoot, "tsconfig.json");
const counterFileName = path.join(
  projectRoot,
  "src/features/effect-lab/counter.tsx",
);

describe("createEffectReactLanguageService", () => {
  it("shows bubbled and discharged requirements in actual TypeScript quick info", () => {
    const service = createService();
    const source = fs.readFileSync(counterFileName, "utf8");

    expect(quickInfoOf(service, source, "CounterInstrument")).toContain(
      'StoreRequirement<"LabCounter", CounterState>',
    );
    expect(quickInfoOf(service, source, "ProvidedCounterInstrument")).toContain(
      "never>",
    );
  });
});

function createService() {
  const config = ts.readConfigFile(configFileName, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    projectRoot,
    {},
    configFileName,
  );
  const host = {
    fileExists: ts.sys.fileExists,
    getCompilationSettings: () => parsed.options,
    getCurrentDirectory: () => projectRoot,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    getScriptFileNames: () => parsed.fileNames,
    getScriptSnapshot: (fileName: string) => {
      const source = ts.sys.readFile(fileName);
      return source ? ts.ScriptSnapshot.fromString(source) : undefined;
    },
    getScriptVersion: () => "1",
    readDirectory: ts.sys.readDirectory,
    readFile: ts.sys.readFile,
  } satisfies ts.LanguageServiceHost;
  const languageService = ts.createLanguageService(host);
  return createEffectReactLanguageService({
    languageService,
    languageServiceHost: host,
    typescript: ts,
  });
}

function quickInfoOf(
  service: ts.LanguageService,
  source: string,
  name: string,
) {
  const position = source.indexOf(`const ${name}`) + "const ".length;
  const quickInfo = service.getQuickInfoAtPosition(counterFileName, position);
  return ts.displayPartsToString(quickInfo?.displayParts);
}
