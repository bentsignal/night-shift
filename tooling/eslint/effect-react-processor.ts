import type { Linter } from "eslint";
import ts from "typescript";

const virtualHookName = "useSt";

/**
 * Lets the standard React Hooks rules recognize createComponent's `state`
 * callback as a hook without changing the authored API.
 *
 * The virtual name has the same width as `state`, so diagnostics and autofixes
 * retain their original source positions.
 */
export const effectReactProcessor = {
  meta: {
    name: "@night-shift/effect-react-hooks",
    version: "0.1.0",
  },
  postprocess(messages: ReadonlyArray<ReadonlyArray<Linter.LintMessage>>) {
    return [...(messages[0] ?? [])];
  },
  preprocess(source: string, fileName: string) {
    const sourceFile = ts.createSourceFile(
      fileName,
      source,
      ts.ScriptTarget.Latest,
      true,
      fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const positions = Array<number>();

    const visit = (node: ts.Node) => {
      if (
        ts.isPropertyAssignment(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === "state" &&
        (ts.isArrowFunction(node.initializer) ||
          ts.isFunctionExpression(node.initializer)) &&
        isCreateComponentDefinition(node.parent)
      ) {
        positions.push(node.name.getStart(sourceFile));
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    let transformed = source;
    for (const position of positions.reverse()) {
      transformed =
        transformed.slice(0, position) +
        virtualHookName +
        transformed.slice(position + virtualHookName.length);
    }
    return [transformed];
  },
  supportsAutofix: true,
};

function isCreateComponentDefinition(node: ts.ObjectLiteralExpression) {
  const parent = node.parent;
  if (!ts.isCallExpression(parent) || parent.arguments[0] !== node) {
    return false;
  }
  const factory = parent.expression;
  return (
    (ts.isIdentifier(factory) && factory.text === "createComponent") ||
    (ts.isPropertyAccessExpression(factory) &&
      factory.name.text === "createComponent")
  );
}
