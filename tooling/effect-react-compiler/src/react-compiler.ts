import ts from "typescript";

import type { SourceModel } from "./model.js";
import { unwrapExpression, visit } from "./ast.js";

type Insertion = {
  readonly position: number;
  readonly text: string;
};

type TransformContext = {
  readonly annotatedBodies: Set<number>;
  readonly callbacks: ReadonlyMap<string, ts.FunctionLikeDeclaration>;
  readonly insertions: Insertion[];
  readonly sourceFile: ts.SourceFile;
};

const effectReactModule = "@night-shift/effect-react";
const memoDirective = '"use memo";';

export function collectReactCompilerInsertions(model: SourceModel) {
  const context = {
    annotatedBodies: new Set(),
    callbacks: collectModuleCallbacks(model.sourceFile),
    insertions: Array<Insertion>(),
    sourceFile: model.sourceFile,
  } satisfies TransformContext;
  const imports = collectImports(model.sourceFile);

  visit(model.sourceFile, (node) => {
    if (!ts.isCallExpression(node)) {
      return;
    }

    if (isEffectGenCall(node, imports.effectNamespaces)) {
      const generator = node.arguments[0];
      if (
        generator &&
        (ts.isArrowFunction(generator) || ts.isFunctionExpression(generator))
      ) {
        annotateReturnedHooks(context, generator, true);
      }
    }

    if (
      isComponentFactoryCall(
        node.expression,
        imports.apiNamespaces,
        imports.componentFactories,
      )
    ) {
      const definition = node.arguments[0];
      if (definition && ts.isObjectLiteralExpression(definition)) {
        annotateComponent(context, definition);
      }
      return;
    }

    if (isProviderCall(node)) {
      const definition = node.arguments[0];
      if (definition && ts.isObjectLiteralExpression(definition)) {
        annotateNamedCallback(context, definition, "implementation");
      }
    }
  });

  return context.insertions;
}

function annotateComponent(
  context: TransformContext,
  definition: ts.ObjectLiteralExpression,
) {
  annotateNamedCallback(context, definition, "component");

  const state = findPropertyExpression(definition, "state");
  if (state) {
    annotateStateHooks(context, state);
  }
}

function annotateNamedCallback(
  context: TransformContext,
  definition: ts.ObjectLiteralExpression,
  name: string,
) {
  for (const property of definition.properties) {
    if (propertyName(property.name) !== name) {
      continue;
    }
    if (ts.isMethodDeclaration(property)) {
      annotateFunction(context, property);
      return;
    }
    if (ts.isPropertyAssignment(property)) {
      annotateExpression(context, property.initializer);
      return;
    }
    if (ts.isShorthandPropertyAssignment(property)) {
      const callback = context.callbacks.get(property.name.text);
      if (callback) {
        annotateFunction(context, callback);
      }
      return;
    }
  }
}

function annotateStateHooks(
  context: TransformContext,
  expression: ts.Expression,
) {
  const state = unwrapExpression(expression);
  if (
    ts.isCallExpression(state) &&
    ts.isPropertyAccessExpression(state.expression) &&
    state.expression.name.text === "succeed"
  ) {
    const hook = state.arguments[0];
    if (hook) {
      annotateExpression(context, hook);
    }
  }

  annotateReturnedHooks(context, state, false);
}

function annotateReturnedHooks(
  context: TransformContext,
  expression: ts.Node,
  namedHooksOnly: boolean,
) {
  const walk = (node: ts.Node) => {
    if (ts.isReturnStatement(node) && node.expression) {
      const returned = unwrapExpression(node.expression);
      if (ts.isArrowFunction(returned) || ts.isFunctionExpression(returned)) {
        if (!namedHooksOnly || isHookName(returned.name?.text)) {
          annotateFunction(context, returned);
        }
        return;
      }
      if (ts.isIdentifier(returned)) {
        const callback = context.callbacks.get(returned.text);
        if (callback && (!namedHooksOnly || isHookName(returned.text))) {
          annotateFunction(context, callback);
        }
      }
    }
    ts.forEachChild(node, walk);
  };

  walk(expression);
}

function annotateExpression(
  context: TransformContext,
  expression: ts.Expression,
) {
  const callback = unwrapExpression(expression);
  if (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) {
    annotateFunction(context, callback);
    return;
  }
  if (ts.isIdentifier(callback)) {
    const declaration = context.callbacks.get(callback.text);
    if (declaration) {
      annotateFunction(context, declaration);
    }
  }
}

function annotateFunction(
  context: TransformContext,
  callback: ts.FunctionLikeDeclaration,
) {
  const body = callback.body;
  if (!body || context.annotatedBodies.has(body.pos)) {
    return;
  }
  context.annotatedBodies.add(body.pos);

  if (ts.isBlock(body)) {
    if (!hasMemoDirective(body)) {
      context.insertions.push({
        position: body.getStart(context.sourceFile) + 1,
        text: `\n${memoDirective}\n`,
      });
    }
    return;
  }

  context.insertions.push({
    position: body.getStart(context.sourceFile),
    text: `{ ${memoDirective} return `,
  });
  context.insertions.push({
    position: body.end,
    text: "; }",
  });
}

function hasMemoDirective(body: ts.Block) {
  for (const statement of body.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    ) {
      return false;
    }
    if (
      statement.expression.text === "use memo" ||
      statement.expression.text === "use no memo"
    ) {
      return true;
    }
  }
  return false;
}

function collectModuleCallbacks(sourceFile: ts.SourceFile) {
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

function collectImports(sourceFile: ts.SourceFile) {
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
      if (bindings && ts.isNamespaceImport(bindings)) {
        effectNamespaces.add(bindings.name.text);
      }
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if ((element.propertyName?.text ?? element.name.text) === "Effect") {
            effectNamespaces.add(element.name.text);
          }
        }
      }
      continue;
    }
    if (moduleName !== effectReactModule) {
      continue;
    }

    if (bindings && ts.isNamespaceImport(bindings)) {
      apiNamespaces.add(bindings.name.text);
    }
    if (!bindings || !ts.isNamedImports(bindings)) {
      continue;
    }

    for (const element of bindings.elements) {
      if (
        (element.propertyName?.text ?? element.name.text) === "createComponent"
      ) {
        componentFactories.add(element.name.text);
      }
    }
  }

  return { apiNamespaces, componentFactories, effectNamespaces };
}

function findPropertyExpression(
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

function isComponentFactoryCall(
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

function isProviderCall(expression: ts.CallExpression) {
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

function isEffectGenCall(
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

function isHookName(name: string | undefined) {
  return !!name && /^use[A-Z0-9]/u.test(name);
}

function propertyName(name: ts.PropertyName | undefined) {
  return name && (ts.isIdentifier(name) || ts.isStringLiteralLike(name))
    ? name.text
    : undefined;
}
