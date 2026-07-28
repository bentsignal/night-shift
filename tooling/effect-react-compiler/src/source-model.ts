import ts from "typescript";

import type {
  ComponentDeclaration,
  ImportBinding,
  SourceModel,
  StoreDeclaration,
  SymbolReference,
} from "./model.js";
import {
  hasExportModifier,
  locationOf,
  makeReference,
  resolveModuleFile,
  unwrapExpression,
} from "./ast.js";
import {
  collectOrdinaryBoundaries,
  readComponentDefinition,
  readProvidedDefinition,
  readStoreName,
} from "./declarations.js";

const effectReactModule = "@night-shift/effect-react";

export function buildSourceModel({
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
