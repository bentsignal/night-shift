import path from "node:path";
import ts from "typescript";

import type { SymbolReference } from "./model.js";

const sourceExtensions = [".ts", ".tsx", ".js", ".jsx"] as const;

export function findPropertyInitializer(
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

export function readJsxTagName(node: ts.Node) {
  if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) {
    return undefined;
  }
  return ts.isIdentifier(node.tagName) ? node.tagName : undefined;
}

export function findJsxOwnerName(node: ts.Node) {
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

export function resolveModuleFile({
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

export function unwrapExpression(expression: ts.Expression) {
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

export function visit(node: ts.Node, visitor: (node: ts.Node) => void) {
  visitor(node);
  ts.forEachChild(node, (child) => {
    visit(child, visitor);
  });
}

export function makeReference({
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
  } satisfies SymbolReference;
}

export function locationOf(sourceFile: ts.SourceFile, node: ts.Node) {
  const location = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );
  return { column: location.character + 1, line: location.line + 1 };
}

export function hasExportModifier(node: ts.Node) {
  return (
    ts.canHaveModifiers(node) &&
    ts
      .getModifiers(node)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  );
}

export function startsWithUppercase(value: string) {
  return /^[A-Z]/u.test(value);
}

export function normalizeFileName(fileName: string) {
  return path.normalize(path.resolve(fileName));
}

export function symbolId(fileName: string, name: string) {
  return `${fileName}#${name}`;
}

function propertyNameText(name: ts.PropertyName) {
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name)
    ? name.text
    : undefined;
}
