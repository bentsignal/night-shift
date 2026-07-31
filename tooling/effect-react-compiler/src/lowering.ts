import ts from "typescript";

import type { SourceModel } from "./model.js";
import type { EffectReactSource } from "./types.js";
import { normalizeFileName, visit } from "./ast.js";
import { resolveComponent } from "./graph.js";
import { collectReactCompilerInsertions } from "./react-compiler.js";
import { buildSourceModel } from "./source-model.js";

export interface SourceInsertion {
  readonly position: number;
  readonly text: string;
}

export interface LoweredEffectReactSource {
  readonly insertions: readonly SourceInsertion[];
  readonly source: string;
}

export function lowerEffectReactSources(sources: readonly EffectReactSource[]) {
  const normalizedSources = new Map(
    sources.map((source) => [
      normalizeFileName(source.fileName),
      source.source,
    ]),
  );
  const models = new Map<string, SourceModel>();

  for (const [fileName, source] of normalizedSources) {
    models.set(
      fileName,
      buildSourceModel({ fileName, knownFiles: normalizedSources, source }),
    );
  }

  return new Map(
    [...models].map(([fileName, model]) => {
      const insertions = collectInsertions({ model, models });
      return [
        fileName,
        {
          insertions,
          source: applyInsertions(
            normalizedSources.get(fileName) ?? "",
            insertions,
          ),
        } satisfies LoweredEffectReactSource,
      ];
    }),
  );
}

export function originalToLoweredPosition(
  position: number,
  insertions: readonly SourceInsertion[],
) {
  return (
    position +
    insertions
      .filter((insertion) => insertion.position <= position)
      .reduce((length, insertion) => length + insertion.text.length, 0)
  );
}

export function loweredToOriginalPosition(
  position: number,
  insertions: readonly SourceInsertion[],
) {
  let insertedLength = 0;

  for (const insertion of insertions) {
    const loweredStart = insertion.position + insertedLength;
    const loweredEnd = loweredStart + insertion.text.length;
    if (position < loweredStart) {
      break;
    }
    if (position <= loweredEnd) {
      return insertion.position;
    }
    insertedLength += insertion.text.length;
  }

  return position - insertedLength;
}

function collectInsertions({
  model,
  models,
}: {
  readonly model: SourceModel;
  readonly models: ReadonlyMap<string, SourceModel>;
}) {
  const insertions = Array<SourceInsertion>(
    ...collectReactCompilerInsertions(model),
    ...collectStoreImplementationInsertions(model),
  );

  for (const declaration of model.components.values()) {
    const groups = new Map<
      string,
      (typeof declaration.jsxChildReferences)[number][]
    >();
    for (const reference of declaration.jsxChildReferences) {
      if (!resolveComponent({ models, reference: reference.component })) {
        continue;
      }
      const key = reference.providers
        .map((provider) => provider.name)
        .join("\u0000");
      const group = groups.get(key) ?? [];
      group.push(reference);
      groups.set(key, group);
    }
    const annotations = Array<string>();

    for (const references of groups.values()) {
      const children = [
        ...new Set(references.map((reference) => reference.component.name)),
      ];
      const providers = [
        ...new Set(
          references.flatMap((reference) =>
            reference.providers.map((provider) => provider.name),
          ),
        ),
      ];

      annotations.push(
        providers.length === 0
          ? `.__effectReactRequirements(${children.join(", ")})`
          : `.__effectReactProvidedRequirements([${providers.join(
              ", ",
            )}], ${children.join(", ")})`,
      );
    }

    annotations.push(".__effectReactAnalyzed()");
    insertions.push({
      position: declaration.initializerEnd,
      text: annotations.join(""),
    });
  }

  return insertions.sort((left, right) => left.position - right.position);
}

function collectStoreImplementationInsertions(model: SourceModel) {
  const insertions = Array<SourceInsertion>();

  visit(model.sourceFile, (node) => {
    if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) {
      return;
    }
    if (
      !ts.isIdentifier(node.tagName) ||
      !node.attributes.properties.some(
        (property) =>
          ts.isJsxAttribute(property) &&
          ts.isIdentifier(property.name) &&
          property.name.text === "implements",
      )
    ) {
      return;
    }

    for (const property of node.attributes.properties) {
      if (
        !ts.isJsxAttribute(property) ||
        !ts.isIdentifier(property.name) ||
        property.name.text !== "implements" ||
        !property.initializer ||
        !ts.isJsxExpression(property.initializer) ||
        !property.initializer.expression ||
        !ts.isIdentifier(property.initializer.expression) ||
        !/^use[A-Z0-9]/u.test(property.initializer.expression.text)
      ) {
        continue;
      }

      const implementation = property.initializer.expression;
      insertions.push({
        position: implementation.getStart(model.sourceFile),
        text: `${node.tagName.text}.__effectReactImplementation(`,
      });
      insertions.push({
        position: implementation.end,
        text: "())",
      });
    }
  });

  return insertions;
}

function applyInsertions(
  source: string,
  insertions: readonly SourceInsertion[],
) {
  let lowered = source;

  for (const insertion of [...insertions].reverse()) {
    lowered =
      lowered.slice(0, insertion.position) +
      insertion.text +
      lowered.slice(insertion.position);
  }

  return lowered;
}
