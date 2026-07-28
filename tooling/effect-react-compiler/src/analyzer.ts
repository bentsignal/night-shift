import path from "node:path";
import ts from "typescript";

import type {
  AnalyzedComponent,
  AnalyzeEffectReactOptions,
  EffectReactAnalysis,
  EffectReactDiagnostic,
  ReactBoundary,
  SourceLocation,
} from "./types";

type SymbolReference = {
  readonly fileName: string;
  readonly location: SourceLocation;
  readonly name: string;
};

type ImportBinding = {
  readonly exportedName: string;
  readonly fileName: string;
};

type StoreDeclaration = {
  readonly fileName: string;
  readonly location: SourceLocation;
  readonly name: string;
  readonly serviceName: string;
};

type ComponentDeclaration = {
  readonly childReferences: readonly SymbolReference[];
  readonly fileName: string;
  readonly kind: "component" | "provided";
  readonly location: SourceLocation;
  readonly name: string;
  readonly providedStoreReference: SymbolReference | undefined;
  readonly serviceReferences: readonly SymbolReference[];
};

type OrdinaryJsxBoundary = {
  readonly componentReference: SymbolReference;
  readonly ownerName: string;
};

type SourceModel = {
  readonly components: Map<string, ComponentDeclaration>;
  readonly exports: Map<string, SymbolReference>;
  readonly fileName: string;
  readonly imports: Map<string, ImportBinding>;
  readonly ordinaryBoundaries: readonly OrdinaryJsxBoundary[];
  readonly sourceFile: ts.SourceFile;
  readonly stores: Map<string, StoreDeclaration>;
};

type GraphComponent = {
  readonly declaration: ComponentDeclaration;
  readonly dependencies: Set<string>;
  readonly directRequirements: Set<string>;
  readonly id: string;
  readonly providedRequirements: Set<string>;
};

const effectReactModule = "@night-shift/effect-react";
const sourceExtensions = [".ts", ".tsx", ".js", ".jsx"] as const;

export function analyzeEffectReact(options: AnalyzeEffectReactOptions) {
  const normalizedSources = new Map(
    options.sources.map((source) => [
      normalizeFileName(source.fileName),
      source.source,
    ]),
  );
  const models = new Map<string, SourceModel>();

  for (const [fileName, source] of normalizedSources) {
    models.set(
      fileName,
      buildSourceModel({ fileName, knownFiles: normalizedSources, source }),
    );
  }

  const diagnostics = Array<EffectReactDiagnostic>();
  const graph = buildComponentGraph({ diagnostics, models });
  const requirements = computeRequirements(graph);

  diagnostics.push(...findCycles(graph));

  const boundaries = [
    ...buildReactBoundaries({ graph, models, requirements }),
    ...buildExplicitBoundaries({
      diagnostics,
      graph,
      models,
      requirements,
      roots: options.roots ?? [],
    }),
  ];

  for (const boundary of boundaries) {
    if (boundary.requirements.length === 0) {
      continue;
    }

    diagnostics.push({
      code: "unresolved-root",
      fileName: boundary.fileName,
      location: boundary.location,
      message: `${boundary.kind === "react" ? `React component "${boundary.ownerName}" renders` : `Root "${boundary.ownerName}" resolves to`} Effect component "${boundary.componentName}" with unresolved services: ${boundary.requirements
        .map(
          (requirement) =>
            `${requirement} via ${boundary.requirementPaths[requirement]?.join(" -> ") ?? boundary.componentName}`,
        )
        .join("; ")}. Provide those stores before this boundary.`,
    });
  }

  const components = [...graph.values()]
    .map((component) =>
      toAnalyzedComponent({
        component,
        requirements: requirements.get(component.id),
      }),
    )
    .sort(compareComponents);
  const sortedBoundaries = boundaries.sort(compareBoundaries);
  const sortedDiagnostics = diagnostics.sort(compareDiagnostics);

  return {
    boundaries: sortedBoundaries,
    components,
    diagnostics: sortedDiagnostics,
    hasErrors: sortedDiagnostics.length > 0,
  } satisfies EffectReactAnalysis;
}

function buildSourceModel({
  fileName,
  knownFiles,
  source,
}: {
  readonly fileName: string;
  readonly knownFiles: ReadonlyMap<string, string>;
  readonly source: string;
}) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") || fileName.endsWith(".jsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  );
  const imports = new Map<string, ImportBinding>();
  const exports = new Map<string, SymbolReference>();
  const componentFactories = new Set(["createComponent"]);
  const storeFactories = new Set(["createStore"]);
  const apiNamespaces = new Set<string>();

  collectImports({
    apiNamespaces,
    componentFactories,
    fileName,
    imports,
    knownFiles,
    sourceFile,
    storeFactories,
  });
  collectExports({ exports, fileName, knownFiles, sourceFile });

  const components = new Map<string, ComponentDeclaration>();
  const stores = new Map<string, StoreDeclaration>();
  const declarationSpans = Array<{
    readonly end: number;
    readonly start: number;
  }>();

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
        continue;
      }

      const initializer = unwrapExpression(declaration.initializer);
      const storeName = readStoreName({
        apiNamespaces,
        expression: initializer,
        storeFactories,
      });

      if (storeName) {
        stores.set(declaration.name.text, {
          fileName,
          location: locationOf(sourceFile, declaration.name),
          name: declaration.name.text,
          serviceName: storeName,
        });
        declarationSpans.push({
          end: initializer.end,
          start: initializer.getStart(sourceFile),
        });
        continue;
      }

      const componentDefinition = readComponentDefinition({
        apiNamespaces,
        componentFactories,
        expression: initializer,
        fileName,
        sourceFile,
      });

      if (componentDefinition) {
        components.set(declaration.name.text, {
          ...componentDefinition,
          name: declaration.name.text,
        });
        declarationSpans.push({
          end: initializer.end,
          start: initializer.getStart(sourceFile),
        });
        continue;
      }

      const providedDefinition = readProvidedDefinition({
        expression: initializer,
        fileName,
        sourceFile,
      });

      if (providedDefinition) {
        components.set(declaration.name.text, {
          ...providedDefinition,
          name: declaration.name.text,
        });
        declarationSpans.push({
          end: initializer.end,
          start: initializer.getStart(sourceFile),
        });
      }
    }
  }

  const ordinaryBoundaries = collectOrdinaryBoundaries({
    declarationSpans,
    fileName,
    sourceFile,
  });

  return {
    components,
    exports,
    fileName,
    imports,
    ordinaryBoundaries,
    sourceFile,
    stores,
  } satisfies SourceModel;
}

function collectImports({
  apiNamespaces,
  componentFactories,
  fileName,
  imports,
  knownFiles,
  sourceFile,
  storeFactories,
}: {
  readonly apiNamespaces: Set<string>;
  readonly componentFactories: Set<string>;
  readonly fileName: string;
  readonly imports: Map<string, ImportBinding>;
  readonly knownFiles: ReadonlyMap<string, string>;
  readonly sourceFile: ts.SourceFile;
  readonly storeFactories: Set<string>;
}) {
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.importClause
    ) {
      continue;
    }

    const moduleName = statement.moduleSpecifier.text;
    if (moduleName === effectReactModule) {
      const bindings = statement.importClause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) {
        apiNamespaces.add(bindings.name.text);
      }
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          const importedName = element.propertyName?.text ?? element.name.text;
          if (importedName === "createComponent") {
            componentFactories.add(element.name.text);
          }
          if (importedName === "createStore") {
            storeFactories.add(element.name.text);
          }
        }
      }
      continue;
    }

    const importedFileName = resolveModuleFile({
      fileName,
      knownFiles,
      moduleName,
    });
    if (!importedFileName) {
      continue;
    }

    if (statement.importClause.name) {
      imports.set(statement.importClause.name.text, {
        exportedName: "default",
        fileName: importedFileName,
      });
    }

    const bindings = statement.importClause.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) {
      continue;
    }

    for (const element of bindings.elements) {
      imports.set(element.name.text, {
        exportedName: element.propertyName?.text ?? element.name.text,
        fileName: importedFileName,
      });
    }
  }
}

function collectExports({
  exports,
  fileName,
  knownFiles,
  sourceFile,
}: {
  readonly exports: Map<string, SymbolReference>;
  readonly fileName: string;
  readonly knownFiles: ReadonlyMap<string, string>;
  readonly sourceFile: ts.SourceFile;
}) {
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          exports.set(
            declaration.name.text,
            makeReference({
              fileName,
              name: declaration.name,
              sourceFile,
            }),
          );
        }
      }
      continue;
    }

    if (
      !ts.isExportDeclaration(statement) ||
      !statement.exportClause ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      continue;
    }

    const targetFileName =
      statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
        ? resolveModuleFile({
            fileName,
            knownFiles,
            moduleName: statement.moduleSpecifier.text,
          })
        : fileName;

    if (!targetFileName) {
      continue;
    }

    for (const element of statement.exportClause.elements) {
      exports.set(element.name.text, {
        fileName: targetFileName,
        location: locationOf(sourceFile, element.name),
        name: element.propertyName?.text ?? element.name.text,
      });
    }
  }
}

function readStoreName({
  apiNamespaces,
  expression,
  storeFactories,
}: {
  readonly apiNamespaces: ReadonlySet<string>;
  readonly expression: ts.Expression;
  readonly storeFactories: ReadonlySet<string>;
}) {
  if (!ts.isCallExpression(expression)) {
    return undefined;
  }

  const factoryCall = unwrapExpression(expression.expression);
  if (
    !ts.isCallExpression(factoryCall) ||
    !isApiCall({
      apiNamespaces,
      expression: factoryCall.expression,
      localNames: storeFactories,
      name: "createStore",
    })
  ) {
    return undefined;
  }

  const name = factoryCall.arguments[0];
  return name && ts.isStringLiteralLike(name) ? name.text : undefined;
}

function readComponentDefinition({
  apiNamespaces,
  componentFactories,
  expression,
  fileName,
  sourceFile,
}: {
  readonly apiNamespaces: ReadonlySet<string>;
  readonly componentFactories: ReadonlySet<string>;
  readonly expression: ts.Expression;
  readonly fileName: string;
  readonly sourceFile: ts.SourceFile;
}) {
  if (
    !ts.isCallExpression(expression) ||
    !isApiCall({
      apiNamespaces,
      expression: expression.expression,
      localNames: componentFactories,
      name: "createComponent",
    })
  ) {
    return undefined;
  }

  const definition = expression.arguments[0];
  if (!definition || !ts.isObjectLiteralExpression(definition)) {
    return undefined;
  }

  const state = findPropertyInitializer(definition, "state");
  const component = findPropertyInitializer(definition, "component");
  const childReferences = [
    ...(state
      ? collectYieldedComponents({ expression: state, fileName, sourceFile })
      : []),
    ...(component
      ? collectJsxReferences({ expression: component, fileName, sourceFile })
      : []),
  ];
  const serviceReferences = state
    ? collectYieldedServices({ expression: state, fileName, sourceFile })
    : [];

  return {
    childReferences,
    fileName,
    kind: "component" as const,
    location: locationOf(sourceFile, expression),
    providedStoreReference: undefined,
    serviceReferences,
  };
}

function readProvidedDefinition({
  expression,
  fileName,
  sourceFile,
}: {
  readonly expression: ts.Expression;
  readonly fileName: string;
  readonly sourceFile: ts.SourceFile;
}) {
  if (
    !ts.isCallExpression(expression) ||
    !ts.isPropertyAccessExpression(expression.expression) ||
    expression.expression.name.text !== "provide" ||
    !ts.isIdentifier(expression.expression.expression)
  ) {
    return undefined;
  }

  const definition = expression.arguments[0];
  if (!definition || !ts.isObjectLiteralExpression(definition)) {
    return undefined;
  }

  const component = findPropertyInitializer(definition, "component");
  if (!component || !ts.isIdentifier(component)) {
    return undefined;
  }

  return {
    childReferences: [makeReference({ fileName, name: component, sourceFile })],
    fileName,
    kind: "provided" as const,
    location: locationOf(sourceFile, expression),
    providedStoreReference: makeReference({
      fileName,
      name: expression.expression.expression,
      sourceFile,
    }),
    serviceReferences: [],
  };
}

function collectYieldedServices({
  expression,
  fileName,
  sourceFile,
}: {
  readonly expression: ts.Expression;
  readonly fileName: string;
  readonly sourceFile: ts.SourceFile;
}) {
  const references = Array<SymbolReference>();

  visit(expression, (node) => {
    if (
      !ts.isYieldExpression(node) ||
      !node.asteriskToken ||
      !node.expression ||
      !ts.isPropertyAccessExpression(node.expression) ||
      node.expression.name.text !== "service" ||
      !ts.isIdentifier(node.expression.expression)
    ) {
      return;
    }

    references.push(
      makeReference({
        fileName,
        name: node.expression.expression,
        sourceFile,
      }),
    );
  });

  return references;
}

function collectYieldedComponents({
  expression,
  fileName,
  sourceFile,
}: {
  readonly expression: ts.Expression;
  readonly fileName: string;
  readonly sourceFile: ts.SourceFile;
}) {
  const references = Array<SymbolReference>();

  visit(expression, (node) => {
    if (
      !ts.isYieldExpression(node) ||
      !node.asteriskToken ||
      !node.expression ||
      !ts.isIdentifier(node.expression)
    ) {
      return;
    }

    references.push(
      makeReference({ fileName, name: node.expression, sourceFile }),
    );
  });

  return references;
}

function collectJsxReferences({
  expression,
  fileName,
  sourceFile,
}: {
  readonly expression: ts.Expression;
  readonly fileName: string;
  readonly sourceFile: ts.SourceFile;
}) {
  const references = Array<SymbolReference>();

  visit(expression, (node) => {
    const tagName = readJsxTagName(node);
    if (!tagName || !startsWithUppercase(tagName.text)) {
      return;
    }

    references.push(makeReference({ fileName, name: tagName, sourceFile }));
  });

  return references;
}

function collectOrdinaryBoundaries({
  declarationSpans,
  fileName,
  sourceFile,
}: {
  readonly declarationSpans: ReadonlyArray<{
    readonly end: number;
    readonly start: number;
  }>;
  readonly fileName: string;
  readonly sourceFile: ts.SourceFile;
}) {
  const boundaries = Array<OrdinaryJsxBoundary>();

  visit(sourceFile, (node) => {
    const tagName = readJsxTagName(node);
    if (
      !tagName ||
      !startsWithUppercase(tagName.text) ||
      declarationSpans.some(
        (span) =>
          node.getStart(sourceFile) >= span.start && node.end <= span.end,
      )
    ) {
      return;
    }

    boundaries.push({
      componentReference: makeReference({
        fileName,
        name: tagName,
        sourceFile,
      }),
      ownerName: findJsxOwnerName(node),
    });
  });

  return boundaries;
}

function buildComponentGraph({
  diagnostics,
  models,
}: {
  readonly diagnostics: EffectReactDiagnostic[];
  readonly models: ReadonlyMap<string, SourceModel>;
}) {
  const graph = new Map<string, GraphComponent>();

  for (const model of models.values()) {
    for (const declaration of model.components.values()) {
      const id = symbolId(declaration.fileName, declaration.name);
      graph.set(id, {
        declaration,
        dependencies: new Set(),
        directRequirements: new Set(),
        id,
        providedRequirements: new Set(),
      });
    }
  }

  for (const component of graph.values()) {
    for (const reference of component.declaration.serviceReferences) {
      const store = resolveStore({ models, reference });
      if (store) {
        component.directRequirements.add(store.serviceName);
      } else {
        diagnostics.push(
          unresolvedReferenceDiagnostic(reference, "store service"),
        );
      }
    }

    for (const reference of component.declaration.childReferences) {
      const child = resolveComponent({ models, reference });
      if (child) {
        component.dependencies.add(symbolId(child.fileName, child.name));
      } else if (component.declaration.kind === "provided") {
        diagnostics.push(
          unresolvedReferenceDiagnostic(reference, "provided component"),
        );
      }
    }

    const providedStoreReference = component.declaration.providedStoreReference;
    if (!providedStoreReference) {
      continue;
    }

    const store = resolveStore({ models, reference: providedStoreReference });
    if (store) {
      component.providedRequirements.add(store.serviceName);
    } else {
      diagnostics.push(
        unresolvedReferenceDiagnostic(providedStoreReference, "provider store"),
      );
    }
  }

  return graph;
}

function computeRequirements(graph: ReadonlyMap<string, GraphComponent>) {
  const requirements = new Map<string, Set<string>>();
  for (const component of graph.values()) {
    requirements.set(
      component.id,
      subtract(component.directRequirements, component.providedRequirements),
    );
  }

  let changed = true;
  while (changed) {
    changed = false;

    for (const component of graph.values()) {
      const next = new Set(component.directRequirements);
      for (const dependency of component.dependencies) {
        for (const requirement of requirements.get(dependency) ?? []) {
          next.add(requirement);
        }
      }
      for (const provided of component.providedRequirements) {
        next.delete(provided);
      }

      const current = requirements.get(component.id);
      if (!current || !setsEqual(current, next)) {
        requirements.set(component.id, next);
        changed = true;
      }
    }
  }

  return requirements;
}

function findCycles(graph: ReadonlyMap<string, GraphComponent>) {
  const diagnostics = Array<EffectReactDiagnostic>();
  const state = new Map<string, "done" | "visiting">();
  const stack = Array<string>();
  const reported = new Set<string>();

  const visitComponent = (id: string) => {
    const currentState = state.get(id);
    if (currentState === "done") {
      return;
    }
    if (currentState === "visiting") {
      const cycleStart = stack.indexOf(id);
      const cycle = [...stack.slice(cycleStart), id];
      const key = [...new Set(cycle)].sort().join("|");
      if (!reported.has(key)) {
        reported.add(key);
        const component = graph.get(id);
        if (component) {
          diagnostics.push({
            code: "component-cycle",
            fileName: component.declaration.fileName,
            location: component.declaration.location,
            message: `Effect component cycle detected: ${cycle
              .map(
                (componentId) =>
                  graph.get(componentId)?.declaration.name ?? componentId,
              )
              .join(" -> ")}.`,
          });
        }
      }
      return;
    }

    state.set(id, "visiting");
    stack.push(id);
    for (const dependency of graph.get(id)?.dependencies ?? []) {
      visitComponent(dependency);
    }
    stack.pop();
    state.set(id, "done");
  };

  for (const id of graph.keys()) {
    visitComponent(id);
  }

  return diagnostics;
}

function buildReactBoundaries({
  graph,
  models,
  requirements,
}: {
  readonly graph: ReadonlyMap<string, GraphComponent>;
  readonly models: ReadonlyMap<string, SourceModel>;
  readonly requirements: ReadonlyMap<string, ReadonlySet<string>>;
}) {
  const boundaries = Array<ReactBoundary>();

  for (const model of models.values()) {
    for (const boundary of model.ordinaryBoundaries) {
      const component = resolveComponent({
        models,
        reference: boundary.componentReference,
      });
      if (!component) {
        continue;
      }

      const componentId = symbolId(component.fileName, component.name);
      if (!graph.has(componentId)) {
        continue;
      }

      boundaries.push({
        componentId,
        componentName: component.name,
        fileName: boundary.componentReference.fileName,
        id: `${boundary.componentReference.fileName}:${boundary.componentReference.location.line}:${boundary.componentReference.location.column}:${componentId}`,
        kind: "react",
        location: boundary.componentReference.location,
        ownerName: boundary.ownerName,
        requirementPaths: Object.fromEntries(
          sorted(requirements.get(componentId) ?? []).map((requirement) => [
            requirement,
            findRequirementPath({
              componentId,
              graph,
              requirement,
              requirements,
            }),
          ]),
        ),
        requirements: sorted(requirements.get(componentId) ?? []),
      });
    }
  }

  return boundaries;
}

function buildExplicitBoundaries({
  diagnostics,
  graph,
  models,
  requirements,
  roots,
}: {
  readonly diagnostics: EffectReactDiagnostic[];
  readonly graph: ReadonlyMap<string, GraphComponent>;
  readonly models: ReadonlyMap<string, SourceModel>;
  readonly requirements: ReadonlyMap<string, ReadonlySet<string>>;
  readonly roots: AnalyzeEffectReactOptions["roots"];
}) {
  const boundaries = Array<ReactBoundary>();

  for (const root of roots ?? []) {
    const fileName = normalizeFileName(root.fileName);
    const reference = {
      fileName,
      location: { column: 1, line: 1 },
      name: root.componentName,
    };
    const component = resolveComponent({ models, reference });

    if (!component) {
      diagnostics.push(
        unresolvedReferenceDiagnostic(reference, "root component"),
      );
      continue;
    }

    const componentId = symbolId(component.fileName, component.name);
    if (!graph.has(componentId)) {
      continue;
    }

    boundaries.push({
      componentId,
      componentName: component.name,
      fileName,
      id: `explicit:${fileName}:${root.componentName}`,
      kind: "explicit",
      location: component.location,
      ownerName: root.componentName,
      requirementPaths: Object.fromEntries(
        sorted(requirements.get(componentId) ?? []).map((requirement) => [
          requirement,
          findRequirementPath({
            componentId,
            graph,
            requirement,
            requirements,
          }),
        ]),
      ),
      requirements: sorted(requirements.get(componentId) ?? []),
    });
  }

  return boundaries;
}

function findRequirementPath({
  componentId,
  graph,
  requirement,
  requirements,
}: {
  readonly componentId: string;
  readonly graph: ReadonlyMap<string, GraphComponent>;
  readonly requirement: string;
  readonly requirements: ReadonlyMap<string, ReadonlySet<string>>;
}) {
  const visited = new Set<string>();
  const queue = [
    {
      id: componentId,
      path: [graph.get(componentId)?.declaration.name ?? componentId],
    },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) {
      continue;
    }
    visited.add(current.id);

    const component = graph.get(current.id);
    if (!component || component.providedRequirements.has(requirement)) {
      continue;
    }
    if (component.directRequirements.has(requirement)) {
      return current.path;
    }

    for (const dependency of component.dependencies) {
      if (!requirements.get(dependency)?.has(requirement)) {
        continue;
      }
      queue.push({
        id: dependency,
        path: [
          ...current.path,
          graph.get(dependency)?.declaration.name ?? dependency,
        ],
      });
    }
  }

  return [graph.get(componentId)?.declaration.name ?? componentId];
}

function resolveComponent({
  models,
  reference,
}: {
  readonly models: ReadonlyMap<string, SourceModel>;
  readonly reference: SymbolReference;
}) {
  return resolveDeclaration({
    getDeclaration: (model, name) => model.components.get(name),
    models,
    reference,
  });
}

function resolveStore({
  models,
  reference,
}: {
  readonly models: ReadonlyMap<string, SourceModel>;
  readonly reference: SymbolReference;
}) {
  return resolveDeclaration({
    getDeclaration: (model, name) => model.stores.get(name),
    models,
    reference,
  });
}

function resolveDeclaration<Declaration>({
  getDeclaration,
  models,
  reference,
}: {
  readonly getDeclaration: (
    model: SourceModel,
    name: string,
  ) => Declaration | undefined;
  readonly models: ReadonlyMap<string, SourceModel>;
  readonly reference: SymbolReference;
}) {
  const visited = new Set<string>();
  let current = { fileName: reference.fileName, name: reference.name };

  while (true) {
    const key = symbolId(current.fileName, current.name);
    if (visited.has(key)) {
      return undefined;
    }
    visited.add(key);

    const model = models.get(current.fileName);
    if (!model) {
      return undefined;
    }

    const declaration = getDeclaration(model, current.name);
    if (declaration) {
      return declaration;
    }

    const imported = model.imports.get(current.name);
    if (imported) {
      current = {
        fileName: imported.fileName,
        name: imported.exportedName,
      };
      continue;
    }

    const exported = model.exports.get(current.name);
    if (exported) {
      current = { fileName: exported.fileName, name: exported.name };
      continue;
    }

    return undefined;
  }
}

function toAnalyzedComponent({
  component,
  requirements,
}: {
  readonly component: GraphComponent;
  readonly requirements: ReadonlySet<string> | undefined;
}) {
  return {
    dependencies: sorted(component.dependencies),
    directRequirements: sorted(component.directRequirements),
    fileName: component.declaration.fileName,
    id: component.id,
    kind: component.declaration.kind,
    location: component.declaration.location,
    name: component.declaration.name,
    providedRequirements: sorted(component.providedRequirements),
    requirements: sorted(requirements ?? []),
  } satisfies AnalyzedComponent;
}

function findPropertyInitializer(
  object: ts.ObjectLiteralExpression,
  name: string,
) {
  for (const property of object.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      propertyNameText(property.name) === name
    ) {
      return unwrapExpression(property.initializer);
    }
  }
  return undefined;
}

function readJsxTagName(node: ts.Node) {
  if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) {
    return undefined;
  }
  return ts.isIdentifier(node.tagName) ? node.tagName : undefined;
}

function findJsxOwnerName(node: ts.Node) {
  let current = node.parent as ts.Node | undefined;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      return current.name.text;
    }
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      return current.parent.name.text;
    }
    current = current.parent;
  }
  return "<module>";
}

function isApiCall({
  apiNamespaces,
  expression,
  localNames,
  name,
}: {
  readonly apiNamespaces: ReadonlySet<string>;
  readonly expression: ts.Expression;
  readonly localNames: ReadonlySet<string>;
  readonly name: string;
}) {
  const target = unwrapExpression(expression);
  if (ts.isIdentifier(target)) {
    return localNames.has(target.text);
  }
  return (
    ts.isPropertyAccessExpression(target) &&
    ts.isIdentifier(target.expression) &&
    apiNamespaces.has(target.expression.text) &&
    target.name.text === name
  );
}

function resolveModuleFile({
  fileName,
  knownFiles,
  moduleName,
}: {
  readonly fileName: string;
  readonly knownFiles: ReadonlyMap<string, string>;
  readonly moduleName: string;
}) {
  if (!moduleName.startsWith(".")) {
    return undefined;
  }

  const base = normalizeFileName(
    path.resolve(path.dirname(fileName), moduleName),
  );
  const candidates = [
    base,
    ...sourceExtensions.map((extension) => `${base}${extension}`),
    ...sourceExtensions.map((extension) =>
      normalizeFileName(path.join(base, `index${extension}`)),
    ),
  ];
  return candidates.find((candidate) => knownFiles.has(candidate));
}

function unwrapExpression(expression: ts.Expression) {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function visit(node: ts.Node, visitor: (node: ts.Node) => void) {
  visitor(node);
  ts.forEachChild(node, (child) => {
    visit(child, visitor);
  });
}

function makeReference({
  fileName,
  name,
  sourceFile,
}: {
  readonly fileName: string;
  readonly name: ts.Identifier;
  readonly sourceFile: ts.SourceFile;
}) {
  return {
    fileName,
    location: locationOf(sourceFile, name),
    name: name.text,
  };
}

function locationOf(sourceFile: ts.SourceFile, node: ts.Node) {
  const location = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );
  return { column: location.character + 1, line: location.line + 1 };
}

function hasExportModifier(node: ts.Node) {
  return (
    ts.canHaveModifiers(node) &&
    ts
      .getModifiers(node)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  );
}

function propertyNameText(name: ts.PropertyName) {
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name)
    ? name.text
    : undefined;
}

function startsWithUppercase(value: string) {
  return /^[A-Z]/u.test(value);
}

function normalizeFileName(fileName: string) {
  return path.normalize(path.resolve(fileName));
}

function symbolId(fileName: string, name: string) {
  return `${fileName}#${name}`;
}

function subtract(source: ReadonlySet<string>, removed: ReadonlySet<string>) {
  return new Set([...source].filter((value) => !removed.has(value)));
}

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  return (
    left.size === right.size && [...left].every((value) => right.has(value))
  );
}

function sorted(values: Iterable<string>) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function unresolvedReferenceDiagnostic(
  reference: SymbolReference,
  kind: string,
) {
  return {
    code: "unresolved-analysis-reference",
    fileName: reference.fileName,
    location: reference.location,
    message: `Unable to resolve ${kind} "${reference.name}" while analyzing Effect React requirements.`,
  } satisfies EffectReactDiagnostic;
}

function compareComponents(left: AnalyzedComponent, right: AnalyzedComponent) {
  return left.id.localeCompare(right.id);
}

function compareBoundaries(left: ReactBoundary, right: ReactBoundary) {
  return left.id.localeCompare(right.id);
}

function compareDiagnostics(
  left: EffectReactDiagnostic,
  right: EffectReactDiagnostic,
) {
  return (
    left.fileName.localeCompare(right.fileName) ||
    left.location.line - right.location.line ||
    left.location.column - right.location.column ||
    left.code.localeCompare(right.code)
  );
}
