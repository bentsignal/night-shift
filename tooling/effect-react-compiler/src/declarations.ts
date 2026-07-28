import ts from "typescript";

import type {
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
    kind: "component",
    location: locationOf(sourceFile, expression),
    providedStoreReference: undefined,
    serviceReferences,
  } satisfies Omit<ComponentDeclaration, "name">;
}

export function readProvidedDefinition({
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
    kind: "provided",
    location: locationOf(sourceFile, expression),
    providedStoreReference: makeReference({
      fileName,
      name: expression.expression.expression,
      sourceFile,
    }),
    serviceReferences: [],
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
