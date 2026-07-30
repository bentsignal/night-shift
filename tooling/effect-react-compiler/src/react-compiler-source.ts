import ts from "typescript";

import { unwrapExpression } from "./ast.js";

const effectReactModule = "@night-shift/effect-react";

export function collectModuleCallbacks(sourceFile: ts.SourceFile) {
  const callbacks = new Map<string, ts.FunctionLikeDeclaration>();

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      callbacks.set(statement.name.text, statement);
      continue;
    }
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
        continue;
      }
      const initializer = unwrapExpression(declaration.initializer);
      if (
        ts.isArrowFunction(initializer) ||
        ts.isFunctionExpression(initializer)
      ) {
        callbacks.set(declaration.name.text, initializer);
      }
    }
  }

  return callbacks;
}

export function collectCompilerImports(sourceFile: ts.SourceFile) {
  const apiNamespaces = new Set<string>();
  const componentFactories = new Set(["createComponent"]);

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.importClause
    ) {
      continue;
    }

    const moduleName = statement.moduleSpecifier.text;
    const bindings = statement.importClause.namedBindings;
    if (moduleName === effectReactModule) {
      collectEffectReactBindings({
        apiNamespaces,
        bindings,
        componentFactories,
      });
    }
  }

  return { apiNamespaces, componentFactories };
}

export function findPropertyExpression(
  definition: ts.ObjectLiteralExpression,
  name: string,
) {
  for (const property of definition.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      propertyName(property.name) === name
    ) {
      return unwrapExpression(property.initializer);
    }
  }
  return undefined;
}

export function isComponentFactoryCall(
  expression: ts.Expression,
  apiNamespaces: ReadonlySet<string>,
  componentFactories: ReadonlySet<string>,
) {
  const target = unwrapExpression(expression);
  if (ts.isIdentifier(target)) {
    return componentFactories.has(target.text);
  }
  return (
    ts.isPropertyAccessExpression(target) &&
    ts.isIdentifier(target.expression) &&
    apiNamespaces.has(target.expression.text) &&
    target.name.text === "createComponent"
  );
}

export function findStoreImplementation(element: ts.JsxOpeningLikeElement) {
  if (
    !ts.isPropertyAccessExpression(element.tagName) ||
    element.tagName.name.text !== "Store" ||
    !ts.isIdentifier(element.tagName.expression)
  ) {
    return undefined;
  }

  for (const property of element.attributes.properties) {
    if (
      ts.isJsxAttribute(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === "implements" &&
      property.initializer &&
      ts.isJsxExpression(property.initializer) &&
      property.initializer.expression
    ) {
      return property.initializer.expression;
    }
  }

  return undefined;
}

export function propertyName(name: ts.PropertyName | undefined) {
  return name && (ts.isIdentifier(name) || ts.isStringLiteralLike(name))
    ? name.text
    : undefined;
}

function collectEffectReactBindings({
  apiNamespaces,
  bindings,
  componentFactories,
}: {
  readonly apiNamespaces: Set<string>;
  readonly bindings: ts.NamedImportBindings | undefined;
  readonly componentFactories: Set<string>;
}) {
  if (bindings && ts.isNamespaceImport(bindings)) {
    apiNamespaces.add(bindings.name.text);
  }
  if (!bindings || !ts.isNamedImports(bindings)) {
    return;
  }
  for (const element of bindings.elements) {
    if (
      (element.propertyName?.text ?? element.name.text) === "createComponent"
    ) {
      componentFactories.add(element.name.text);
    }
  }
}
