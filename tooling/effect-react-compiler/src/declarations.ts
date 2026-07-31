import ts from "typescript";

import type {
  ChildReference,
  ComponentDeclaration,
  OrdinaryJsxBoundary,
  SymbolReference,
} from "./model.js";
import {
  findJsxOwnerName,
  findPropertyInitializer,
  locationOf,
  makeReference,
  readJsxTagName,
  startsWithUppercase,
  unwrapExpression,
  visit,
} from "./ast.js";

export function readStoreName({
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

  return isApiCall({
    apiNamespaces,
    expression: expression.expression,
    localNames: storeFactories,
    name: "createStore",
  });
}

export function readComponentDefinition({
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

  const deps = findPropertyInitializer(definition, "deps");
  const ui = findPropertyInitializer(definition, "ui");
  const jsxChildReferences = ui
    ? collectJsxReferences({ expression: ui, fileName, sourceFile })
    : [];
  const childReferences = jsxChildReferences;
  const storeReferences = deps
    ? collectStoreDependencies({ expression: deps, fileName, sourceFile })
    : [];

  return {
    childReferences,
    fileName,
    initializerEnd: expression.end,
    jsxChildReferences,
    kind: "component",
    location: locationOf(sourceFile, expression),
    storeReferences,
  } satisfies Omit<ComponentDeclaration, "name">;
}

export function collectOrdinaryBoundaries({
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

function collectStoreDependencies({
  expression,
  fileName,
  sourceFile,
}: {
  readonly expression: ts.Expression;
  readonly fileName: string;
  readonly sourceFile: ts.SourceFile;
}) {
  const references = Array<SymbolReference>();
  const dependencies = unwrapExpression(expression);
  if (!ts.isArrayLiteralExpression(dependencies)) {
    return references;
  }

  for (const element of dependencies.elements) {
    const dependency = unwrapExpression(element);
    if (!ts.isIdentifier(dependency)) {
      continue;
    }
    references.push(
      makeReference({
        fileName,
        name: dependency,
        sourceFile,
      }),
    );
  }

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
  const references = Array<ChildReference>();

  function collect(node: ts.Node, providers: readonly SymbolReference[]) {
    if (ts.isJsxElement(node)) {
      const provider = readStoreProviderReference({
        fileName,
        node: node.openingElement,
        sourceFile,
      });
      const activeProviders = provider ? [...providers, provider] : providers;
      if (!provider) {
        collectComponentReference({
          fileName,
          node: node.openingElement,
          providers,
          references,
          sourceFile,
        });
      }
      for (const child of node.children) {
        collect(child, activeProviders);
      }
      return;
    }

    if (ts.isJsxSelfClosingElement(node)) {
      if (
        !readStoreProviderReference({
          fileName,
          node,
          sourceFile,
        })
      ) {
        collectComponentReference({
          fileName,
          node,
          providers,
          references,
          sourceFile,
        });
      }
      return;
    }

    ts.forEachChild(node, (child) => {
      collect(child, providers);
    });
  }

  collect(expression, []);

  return references;
}

function collectComponentReference({
  fileName,
  node,
  providers,
  references,
  sourceFile,
}: {
  readonly fileName: string;
  readonly node: ts.JsxOpeningLikeElement;
  readonly providers: readonly SymbolReference[];
  readonly references: ChildReference[];
  readonly sourceFile: ts.SourceFile;
}) {
  const tagName = readJsxTagName(node);
  if (!tagName || !startsWithUppercase(tagName.text)) {
    return;
  }

  references.push({
    component: makeReference({ fileName, name: tagName, sourceFile }),
    providers,
  });
}

function readStoreProviderReference({
  fileName,
  node,
  sourceFile,
}: {
  readonly fileName: string;
  readonly node: ts.JsxOpeningLikeElement;
  readonly sourceFile: ts.SourceFile;
}) {
  const tagName = node.tagName;
  if (!ts.isIdentifier(tagName) || !hasImplementsAttribute(node)) {
    return undefined;
  }

  return makeReference({
    fileName,
    name: tagName,
    sourceFile,
  });
}

function hasImplementsAttribute(node: ts.JsxOpeningLikeElement) {
  return node.attributes.properties.some(
    (property) =>
      ts.isJsxAttribute(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === "implements",
  );
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
