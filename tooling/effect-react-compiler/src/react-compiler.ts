import ts from "typescript";

import type { SourceModel } from "./model.js";
import { visit } from "./ast.js";
import {
  annotateComponent,
  annotateExpression,
  annotateReturnedHooks,
  createAnnotationContext,
} from "./react-compiler-annotations.js";
import {
  collectCompilerImports,
  findStoreImplementation,
  isComponentFactoryCall,
  isEffectGenCall,
} from "./react-compiler-source.js";

export function collectReactCompilerInsertions(model: SourceModel) {
  const context = createAnnotationContext(model.sourceFile);
  const imports = collectCompilerImports(model.sourceFile);

  visit(model.sourceFile, (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const implementation = findStoreImplementation(node);
      if (implementation) {
        annotateExpression(context, implementation);
      }
      return;
    }

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
  });

  return context.insertions;
}
