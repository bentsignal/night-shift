import type { GraphComponent, SourceModel } from "./model.js";
import type {
  AnalyzedComponent,
  AnalyzeEffectReactOptions,
  EffectReactAnalysis,
  EffectReactDiagnostic,
  ReactBoundary,
} from "./types.js";
import { normalizeFileName } from "./ast.js";
import {
  addUnresolvedBoundaryDiagnostics,
  buildExplicitBoundaries,
  buildReactBoundaries,
} from "./boundaries.js";
import {
  buildComponentGraph,
  computeRequirements,
  findCycles,
} from "./graph.js";
import { buildSourceModel } from "./source-model.js";

export function analyzeEffectReact(options: AnalyzeEffectReactOptions) {
  const normalizedSources = new Map(
    options.sources.map((source) => [
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

  const diagnostics = Array<EffectReactDiagnostic>();
  const graph = buildComponentGraph({ diagnostics, models });
  const requirements = computeRequirements(graph);

  diagnostics.push(...findCycles(graph));

  const boundaries = [
    ...buildReactBoundaries({ graph, models, requirements }),
    ...buildExplicitBoundaries({
      diagnostics,
      graph,
      models,
      requirements,
      roots: options.roots ?? [],
    }),
  ];

  addUnresolvedBoundaryDiagnostics({ boundaries, diagnostics });

  const components = [...graph.values()]
    .map((component) =>
      toAnalyzedComponent({
        component,
        requirements: requirements.get(component.id),
      }),
    )
    .sort(compareComponents);
  const sortedBoundaries = boundaries.sort(compareBoundaries);
  const sortedDiagnostics = diagnostics.sort(compareDiagnostics);

  return {
    boundaries: sortedBoundaries,
    components,
    diagnostics: sortedDiagnostics,
    hasErrors: sortedDiagnostics.length > 0,
  } satisfies EffectReactAnalysis;
}

function toAnalyzedComponent({
  component,
  requirements,
}: {
  readonly component: GraphComponent;
  readonly requirements: ReadonlySet<string> | undefined;
}) {
  return {
    dependencies: sorted(
      component.dependencies.map((dependency) => dependency.id),
    ),
    directRequirements: sorted(component.directRequirements),
    fileName: component.declaration.fileName,
    id: component.id,
    kind: component.declaration.kind,
    location: component.declaration.location,
    name: component.declaration.name,
    providedRequirements: sorted(component.providedRequirements),
    requirements: sorted(requirements ?? []),
  } satisfies AnalyzedComponent;
}

function sorted(values: Iterable<string>) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function compareComponents(left: AnalyzedComponent, right: AnalyzedComponent) {
  return left.id.localeCompare(right.id);
}

function compareBoundaries(left: ReactBoundary, right: ReactBoundary) {
  return left.id.localeCompare(right.id);
}

function compareDiagnostics(
  left: EffectReactDiagnostic,
  right: EffectReactDiagnostic,
) {
  return (
    left.fileName.localeCompare(right.fileName) ||
    left.location.line - right.location.line ||
    left.location.column - right.location.column ||
    left.code.localeCompare(right.code)
  );
}
