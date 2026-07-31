import ts from "typescript";

import { unwrapExpression } from "./ast.js";
import {
  collectModuleCallbacks,
  propertyName,
} from "./react-compiler-source.js";

export type ReactCompilerInsertion = {
  readonly position: number;
  readonly text: string;
};

export type AnnotationContext = {
  readonly annotatedBodies: Set<number>;
  readonly callbacks: ReadonlyMap<string, ts.FunctionLikeDeclaration>;
  readonly insertions: ReactCompilerInsertion[];
  readonly sourceFile: ts.SourceFile;
};

const memoDirective = '"use memo";';

export function createAnnotationContext(sourceFile: ts.SourceFile) {
  return {
    annotatedBodies: new Set<number>(),
    callbacks: collectModuleCallbacks(sourceFile),
    insertions: Array<ReactCompilerInsertion>(),
    sourceFile,
  } satisfies AnnotationContext;
}

export function annotateComponent(
  context: AnnotationContext,
  definition: ts.ObjectLiteralExpression,
) {
  annotateNamedCallback(context, definition, "state");
  annotateNamedCallback(context, definition, "ui");
}

export function annotateNamedCallback(
  context: AnnotationContext,
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

export function annotateExpression(
  context: AnnotationContext,
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
  context: AnnotationContext,
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
