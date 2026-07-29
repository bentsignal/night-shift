import ts from "typescript";

import type { SourceModel } from "./model.js";
import { visit } from "./ast.js";
import {
  annotateComponent,
  annotateNamedCallback,
  annotateReturnedHooks,
  createAnnotationContext,
} from "./react-compiler-annotations.js";
import {
  collectCompilerImports,
  isComponentFactoryCall,
  isEffectGenCall,
  isProviderCall,
} from "./react-compiler-source.js";

export function collectReactCompilerInsertions(model: SourceModel) {
  const context = createAnnotationContext(model.sourceFile);
  const imports = collectCompilerImports(model.sourceFile);

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
