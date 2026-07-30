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
  it("shows required and provider-discharged components in quick info", () => {
    const service = createService();
    const source = fs.readFileSync(counterFileName, "utf8");

    expect(() => service.getCompilerOptionsDiagnostics()).not.toThrow();
    expect(quickInfoOf(service, source, "CounterReadout")).toContain(
      'StoreRequirement<"LabCounter", CounterState>',
    );
    expect(quickInfoOf(service, source, "CounterInstrument")).toContain(
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
  class ProjectHost implements ts.LanguageServiceHost {
    fileExists = ts.sys.fileExists;
    readDirectory = ts.sys.readDirectory;
    readFile = ts.sys.readFile;

    getCompilationSettings() {
      this.assertReceiver();
      return parsed.options;
    }

    getCurrentDirectory() {
      this.assertReceiver();
      return projectRoot;
    }

    getDefaultLibFileName(options: ts.CompilerOptions) {
      this.assertReceiver();
      return ts.getDefaultLibFilePath(options);
    }

    getScriptFileNames() {
      this.assertReceiver();
      return parsed.fileNames;
    }

    getScriptSnapshot(fileName: string) {
      this.assertReceiver();
      const source = ts.sys.readFile(fileName);
      return source ? ts.ScriptSnapshot.fromString(source) : undefined;
    }

    getScriptVersion() {
      this.assertReceiver();
      return "1";
    }

    private assertReceiver() {
      if (this !== host) {
        throw new Error("Project host method lost its receiver.");
      }
    }
  }

  const host = new ProjectHost();
  const underlyingService = ts.createLanguageService(host);
  const languageService = new Proxy(underlyingService, {
    get(target, property) {
      const value = Reflect.get(target, property, target) as unknown;
      if (typeof value !== "function") {
        return value;
      }
      return function (this: ts.LanguageService, ...args: unknown[]) {
        if (this !== languageService) {
          throw new Error("Language service method lost its receiver.");
        }
        return Reflect.apply(value, target, args);
      };
    },
  });
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
