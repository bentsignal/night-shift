import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createEffectReactLanguageService } from "../src";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const labProjectRoot = path.join(repositoryRoot, "apps/effect-lab");
const labConfigFileName = path.join(labProjectRoot, "tsconfig.json");
const labCounterFileName = path.join(
  labProjectRoot,
  "src/features/effect-lab/counter.tsx",
);
const labFrameFileName = path.join(
  labProjectRoot,
  "src/features/effect-lab/effect-lab.tsx",
);
const sharedProjectRoot = path.join(repositoryRoot, "shared/effect-react");
const sharedConfigFileName = path.join(sharedProjectRoot, "tsconfig.json");
const sharedCounterFileName = path.join(
  sharedProjectRoot,
  "example/counter.tsx",
);
const multipleStoresFileName = path.join(
  sharedProjectRoot,
  "example/multiple-stores.tsx",
);

describe("createEffectReactLanguageService", () => {
  it("makes missing analysis visible even when deps infer requirements", () => {
    const { service } = createService({
      configFileName: labConfigFileName,
      lower: false,
      projectRoot: labProjectRoot,
    });
    const source = fs.readFileSync(labCounterFileName, "utf8");

    expect(
      quickInfoOf(service, source, labCounterFileName, "CounterControls"),
    ).toContain("EffectReactAnalysisRequired");
    expect(
      quickInfoOf(service, source, labCounterFileName, "CounterControls"),
    ).toContain("StoreRequirement<string,");
  }, 15_000);

  it("updates quick info when a provider is added or removed", () => {
    const project = createService({
      configFileName: labConfigFileName,
      projectRoot: labProjectRoot,
    });
    const source = fs.readFileSync(labCounterFileName, "utf8");
    const withProvider = setCounterProvider(source, true);
    const withoutProvider = setCounterProvider(source, false);

    project.updateFile(labCounterFileName, withProvider);
    expect(() => project.service.getCompilerOptionsDiagnostics()).not.toThrow();
    expect(
      quickInfoOf(
        project.service,
        withProvider,
        labCounterFileName,
        "CounterInstrument",
      ),
    ).toBe("const CounterInstrument: Component<ComponentRequirements<never>>");

    project.updateFile(labCounterFileName, withoutProvider);
    const unresolvedInstrument = quickInfoOf(
      project.service,
      withoutProvider,
      labCounterFileName,
      "CounterInstrument",
    );
    expect(unresolvedInstrument).toContain(
      'const CounterInstrument: Component<StoreRequirement<"Counter",',
    );
    expect(unresolvedInstrument).not.toContain("EffectReactAnalysisRequired");
  }, 15_000);

  it("invalidates unchanged parents when an imported child changes", () => {
    const project = createService({
      configFileName: labConfigFileName,
      projectRoot: labProjectRoot,
    });
    const counterSource = fs.readFileSync(labCounterFileName, "utf8");
    const frameSource = fs.readFileSync(labFrameFileName, "utf8");
    const withProvider = setCounterProvider(counterSource, true);
    const withoutProvider = setCounterProvider(counterSource, false);

    project.updateFile(labCounterFileName, withProvider);
    expect(
      quickInfoOf(
        project.service,
        frameSource,
        labFrameFileName,
        "WorkspaceFrame",
      ),
    ).toBe("const WorkspaceFrame: Component<ComponentRequirements<never>>");

    project.updateFile(labCounterFileName, withoutProvider);
    expect(
      quickInfoOf(
        project.service,
        frameSource,
        labFrameFileName,
        "WorkspaceFrame",
      ),
    ).toContain('const WorkspaceFrame: Component<StoreRequirement<"Counter",');

    project.updateFile(labCounterFileName, withProvider);
    expect(
      quickInfoOf(
        project.service,
        frameSource,
        labFrameFileName,
        "WorkspaceFrame",
      ),
    ).toBe("const WorkspaceFrame: Component<ComponentRequirements<never>>");
  }, 15_000);

  it("discovers a lowercase stateless component added after project load", () => {
    const project = createService({
      configFileName: labConfigFileName,
      projectRoot: labProjectRoot,
    });
    const source = removeTestComponent(
      fs.readFileSync(labCounterFileName, "utf8"),
    );
    const withLowercaseComponent = `${source}

const testComponent = createComponent({
  ui: () => <CounterControls />,
});
`;

    project.updateFile(labCounterFileName, source);
    expect(() => project.service.getCompilerOptionsDiagnostics()).not.toThrow();
    project.updateFile(labCounterFileName, withLowercaseComponent);

    expect(
      quickInfoOf(
        project.service,
        withLowercaseComponent,
        labCounterFileName,
        "testComponent",
      ),
    ).toContain('const testComponent: Component<StoreRequirement<"Counter",');
  }, 15_000);

  it("bubbles shared-example requirements through every JSX parent", () => {
    const { service } = createService({
      configFileName: sharedConfigFileName,
      projectRoot: sharedProjectRoot,
    });
    const source = fs.readFileSync(sharedCounterFileName, "utf8");

    for (const name of [
      "CounterButton",
      "CounterRow",
      "CounterPanel",
      "CounterExample",
    ]) {
      expect(
        quickInfoOf(service, source, sharedCounterFileName, name),
      ).toContain('StoreRequirement<"Counter", CounterState>');
    }
  }, 15_000);

  it("subtracts only the store requirements provided at each boundary", () => {
    const { service } = createService({
      configFileName: sharedConfigFileName,
      projectRoot: sharedProjectRoot,
    });
    const source = fs.readFileSync(multipleStoresFileName, "utf8");

    expect(
      quickInfoOf(service, source, multipleStoresFileName, "IdentityBadge"),
    ).toBe(
      'const IdentityBadge: Component<StoreRequirement<"Viewer", ViewerState> | StoreRequirement<"Theme", ThemeState>>',
    );
    expect(
      quickInfoOf(
        service,
        source,
        multipleStoresFileName,
        "UnprovidedDashboard",
      ),
    ).toBe(
      'const UnprovidedDashboard: Component<StoreRequirement<"Viewer", ViewerState> | StoreRequirement<"Theme", ThemeState> | StoreRequirement<"Workspace", WorkspaceState>>',
    );
    expect(
      quickInfoOf(
        service,
        source,
        multipleStoresFileName,
        "ViewerProvidedDashboard",
      ),
    ).toBe(
      'const ViewerProvidedDashboard: Component<StoreRequirement<"Theme", ThemeState> | StoreRequirement<"Workspace", WorkspaceState>>',
    );
    expect(
      quickInfoOf(
        service,
        source,
        multipleStoresFileName,
        "ViewerAndThemeProvidedDashboard",
      ),
    ).toBe(
      'const ViewerAndThemeProvidedDashboard: Component<StoreRequirement<"Workspace", WorkspaceState>>',
    );
    expect(
      quickInfoOf(
        service,
        source,
        multipleStoresFileName,
        "FullyProvidedDashboard",
      ),
    ).toBe(
      "const FullyProvidedDashboard: Component<ComponentRequirements<never>>",
    );
  }, 15_000);
});

function createService({
  configFileName,
  lower = true,
  projectRoot,
}: {
  configFileName: string;
  lower?: boolean;
  projectRoot: string;
}) {
  const sources = new Map<string, string>();
  const versions = new Map<string, number>();
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

    getProjectVersion() {
      this.assertReceiver();
      return "stable-project";
    }

    getScriptFileNames() {
      this.assertReceiver();
      return parsed.fileNames;
    }

    getScriptSnapshot(fileName: string) {
      this.assertReceiver();
      const source =
        sources.get(path.resolve(fileName)) ?? ts.sys.readFile(fileName);
      return source ? ts.ScriptSnapshot.fromString(source) : undefined;
    }

    getScriptVersion(fileName: string) {
      this.assertReceiver();
      return String(versions.get(path.resolve(fileName)) ?? 1);
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
  const service = lower
    ? createEffectReactLanguageService({
        languageService,
        languageServiceHost: host,
        typescript: ts,
      })
    : languageService;
  return {
    service,
    updateFile(fileName: string, source: string) {
      const resolved = path.resolve(fileName);
      sources.set(resolved, source);
      versions.set(resolved, (versions.get(resolved) ?? 1) + 1);
    },
  };
}

function setCounterProvider(source: string, enabled: boolean) {
  const comment = enabled ? "" : "// ";
  return source
    .replace(
      /^(\s*)(?:\/\/ )?<Counter implements=\{useCounterImplementation\}>$/mu,
      `$1${comment}<Counter implements={useCounterImplementation}>`,
    )
    .replace(/^(\s*)(?:\/\/ )?<\/Counter>$/mu, `$1${comment}</Counter>`);
}

function removeTestComponent(source: string) {
  return source.replace(
    /\nexport const TestComponent = createComponent\(\{[\s\S]*?\n\}\);\n/u,
    "",
  );
}

function quickInfoOf(
  service: ts.LanguageService,
  source: string,
  fileName: string,
  name: string,
) {
  const position = source.indexOf(`const ${name}`) + "const ".length;
  const quickInfo = service.getQuickInfoAtPosition(fileName, position);
  return ts.displayPartsToString(quickInfo?.displayParts);
}
