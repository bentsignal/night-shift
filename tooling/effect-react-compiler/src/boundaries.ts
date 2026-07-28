import type { GraphComponent, SourceModel } from "./model.js";
import type {
  AnalyzeEffectReactOptions,
  EffectReactDiagnostic,
  ReactBoundary,
} from "./types.js";
import { normalizeFileName, symbolId } from "./ast.js";
import { resolveComponent, unresolvedReferenceDiagnostic } from "./graph.js";

export function buildReactBoundaries({
  graph,
  models,
  requirements,
}: {
  readonly graph: ReadonlyMap<string, GraphComponent>;
  readonly models: ReadonlyMap<string, SourceModel>;
  readonly requirements: ReadonlyMap<string, ReadonlySet<string>>;
}) {
  const boundaries = Array<ReactBoundary>();

  for (const model of models.values()) {
    for (const boundary of model.ordinaryBoundaries) {
      const component = resolveComponent({
        models,
        reference: boundary.componentReference,
      });
      if (!component) {
        continue;
      }

      const componentId = symbolId(component.fileName, component.name);
      if (!graph.has(componentId)) {
        continue;
      }

      boundaries.push(
        createBoundary({
          componentId,
          componentName: component.name,
          fileName: boundary.componentReference.fileName,
          graph,
          id: `${boundary.componentReference.fileName}:${boundary.componentReference.location.line}:${boundary.componentReference.location.column}:${componentId}`,
          kind: "react",
          location: boundary.componentReference.location,
          ownerName: boundary.ownerName,
          requirements,
        }),
      );
    }
  }

  return boundaries;
}

export function buildExplicitBoundaries({
  diagnostics,
  graph,
  models,
  requirements,
  roots,
}: {
  readonly diagnostics: EffectReactDiagnostic[];
  readonly graph: ReadonlyMap<string, GraphComponent>;
  readonly models: ReadonlyMap<string, SourceModel>;
  readonly requirements: ReadonlyMap<string, ReadonlySet<string>>;
  readonly roots: AnalyzeEffectReactOptions["roots"];
}) {
  const boundaries = Array<ReactBoundary>();

  for (const root of roots ?? []) {
    const fileName = normalizeFileName(root.fileName);
    const reference = {
      fileName,
      location: { column: 1, line: 1 },
      name: root.componentName,
    };
    const component = resolveComponent({ models, reference });

    if (!component) {
      diagnostics.push(
        unresolvedReferenceDiagnostic(reference, "root component"),
      );
      continue;
    }

    const componentId = symbolId(component.fileName, component.name);
    if (!graph.has(componentId)) {
      continue;
    }

    boundaries.push(
      createBoundary({
        componentId,
        componentName: component.name,
        fileName,
        graph,
        id: `explicit:${fileName}:${root.componentName}`,
        kind: "explicit",
        location: component.location,
        ownerName: root.componentName,
        requirements,
      }),
    );
  }

  return boundaries;
}

export function addUnresolvedBoundaryDiagnostics({
  boundaries,
  diagnostics,
}: {
  readonly boundaries: readonly ReactBoundary[];
  readonly diagnostics: EffectReactDiagnostic[];
}) {
  for (const boundary of boundaries) {
    if (boundary.requirements.length === 0) {
      continue;
    }

    diagnostics.push({
      code: "unresolved-root",
      fileName: boundary.fileName,
      location: boundary.location,
      message: `${boundary.kind === "react" ? `React component "${boundary.ownerName}" renders` : `Root "${boundary.ownerName}" resolves to`} Effect component "${boundary.componentName}" with unresolved services: ${boundary.requirements
        .map(
          (requirement) =>
            `${requirement} via ${boundary.requirementPaths[requirement]?.join(" -> ") ?? boundary.componentName}`,
        )
        .join("; ")}. Provide those stores before this boundary.`,
    });
  }
}

function createBoundary({
  componentId,
  componentName,
  fileName,
  graph,
  id,
  kind,
  location,
  ownerName,
  requirements,
}: Omit<ReactBoundary, "requirementPaths" | "requirements"> & {
  readonly graph: ReadonlyMap<string, GraphComponent>;
  readonly requirements: ReadonlyMap<string, ReadonlySet<string>>;
}) {
  const componentRequirements = sorted(requirements.get(componentId) ?? []);
  return {
    componentId,
    componentName,
    fileName,
    id,
    kind,
    location,
    ownerName,
    requirementPaths: Object.fromEntries(
      componentRequirements.map((requirement) => [
        requirement,
        findRequirementPath({
          componentId,
          graph,
          requirement,
          requirements,
        }),
      ]),
    ),
    requirements: componentRequirements,
  } satisfies ReactBoundary;
}

function findRequirementPath({
  componentId,
  graph,
  requirement,
  requirements,
}: {
  readonly componentId: string;
  readonly graph: ReadonlyMap<string, GraphComponent>;
  readonly requirement: string;
  readonly requirements: ReadonlyMap<string, ReadonlySet<string>>;
}) {
  const visited = new Set<string>();
  const queue = [
    {
      id: componentId,
      path: [graph.get(componentId)?.declaration.name ?? componentId],
    },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) {
      continue;
    }
    visited.add(current.id);

    const component = graph.get(current.id);
    if (!component || component.providedRequirements.has(requirement)) {
      continue;
    }
    if (component.directRequirements.has(requirement)) {
      return current.path;
    }

    for (const dependency of component.dependencies) {
      if (!requirements.get(dependency)?.has(requirement)) {
        continue;
      }
      queue.push({
        id: dependency,
        path: [
          ...current.path,
          graph.get(dependency)?.declaration.name ?? dependency,
        ],
      });
    }
  }

  return [graph.get(componentId)?.declaration.name ?? componentId];
}

function sorted(values: Iterable<string>) {
  return [...values].sort((left, right) => left.localeCompare(right));
}
