import type { SourceModel } from "./model.js";
import type { EffectReactSource } from "./types.js";
import { normalizeFileName } from "./ast.js";
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
  );

  for (const declaration of model.components.values()) {
    if (declaration.kind !== "component") {
      continue;
    }

    const children = [
      ...new Set(
        declaration.jsxChildReferences
          .filter((reference) => resolveComponent({ models, reference }))
          .map((reference) => reference.name),
      ),
    ];
    if (children.length === 0) {
      continue;
    }

    insertions.push({
      position: declaration.initializerEnd,
      text: `.__effectReactRequirements(${children.join(", ")})`,
    });
  }

  return insertions.sort((left, right) => left.position - right.position);
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
