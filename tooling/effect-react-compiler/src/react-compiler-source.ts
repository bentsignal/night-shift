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
  const effectNamespaces = new Set<string>();

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
    if (moduleName === "effect") {
      collectEffectBindings(bindings, effectNamespaces);
      continue;
    }
    if (moduleName === effectReactModule) {
      collectEffectReactBindings({
        apiNamespaces,
        bindings,
        componentFactories,
      });
    }
  }

  return { apiNamespaces, componentFactories, effectNamespaces };
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

export function isProviderCall(expression: ts.CallExpression) {
  if (
    !ts.isPropertyAccessExpression(expression.expression) ||
    expression.expression.name.text !== "provide" ||
    !ts.isIdentifier(expression.expression.expression)
  ) {
    return false;
  }

  const definition = expression.arguments[0];
  return (
    !!definition &&
    ts.isObjectLiteralExpression(definition) &&
    !!findPropertyExpression(definition, "component") &&
    !!findPropertyExpression(definition, "implementation")
  );
}

export function isEffectGenCall(
  expression: ts.CallExpression,
  effectNamespaces: ReadonlySet<string>,
) {
  return (
    ts.isPropertyAccessExpression(expression.expression) &&
    ts.isIdentifier(expression.expression.expression) &&
    effectNamespaces.has(expression.expression.expression.text) &&
    expression.expression.name.text === "gen"
  );
}

export function propertyName(name: ts.PropertyName | undefined) {
  return name && (ts.isIdentifier(name) || ts.isStringLiteralLike(name))
    ? name.text
    : undefined;
}

function collectEffectBindings(
  bindings: ts.NamedImportBindings | undefined,
  effectNamespaces: Set<string>,
) {
  if (bindings && ts.isNamespaceImport(bindings)) {
    effectNamespaces.add(bindings.name.text);
  }
  if (!bindings || !ts.isNamedImports(bindings)) {
    return;
  }
  for (const element of bindings.elements) {
    if ((element.propertyName?.text ?? element.name.text) === "Effect") {
      effectNamespaces.add(element.name.text);
    }
  }
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
