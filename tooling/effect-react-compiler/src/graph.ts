import type { GraphComponent, SourceModel, SymbolReference } from "./model.js";
import type { EffectReactDiagnostic } from "./types.js";
import { symbolId } from "./ast.js";

export function buildComponentGraph({
  diagnostics,
  models,
}: {
  readonly diagnostics: EffectReactDiagnostic[];
  readonly models: ReadonlyMap<string, SourceModel>;
}) {
  const graph = new Map<string, GraphComponent>();

  for (const model of models.values()) {
    for (const declaration of model.components.values()) {
      const id = symbolId(declaration.fileName, declaration.name);
      graph.set(id, {
        declaration,
        dependencies: [],
        directRequirements: new Set(),
        id,
        providedRequirements: new Set(),
      });
    }
  }

  for (const component of graph.values()) {
    collectDirectRequirements({ component, diagnostics, models });
    collectDependencies({ component, diagnostics, models });
  }

  return graph;
}

export function computeRequirements(
  graph: ReadonlyMap<string, GraphComponent>,
) {
  const requirements = new Map<string, Set<string>>();
  for (const component of graph.values()) {
    requirements.set(component.id, new Set(component.directRequirements));
  }

  let changed = true;
  while (changed) {
    changed = false;

    for (const component of graph.values()) {
      const next = new Set(component.directRequirements);
      for (const dependency of component.dependencies) {
        for (const requirement of requirements.get(dependency.id) ?? []) {
          if (!dependency.providedRequirements.has(requirement)) {
            next.add(requirement);
          }
        }
      }

      const current = requirements.get(component.id);
      if (!current || !setsEqual(current, next)) {
        requirements.set(component.id, next);
        changed = true;
      }
    }
  }

  return requirements;
}

export function findCycles(graph: ReadonlyMap<string, GraphComponent>) {
  const diagnostics = Array<EffectReactDiagnostic>();
  const state = new Map<string, "done" | "visiting">();
  const stack = Array<string>();
  const reported = new Set<string>();

  const visitComponent = (id: string) => {
    const currentState = state.get(id);
    if (currentState === "done") {
      return;
    }
    if (currentState === "visiting") {
      reportCycle({ diagnostics, graph, id, reported, stack });
      return;
    }

    state.set(id, "visiting");
    stack.push(id);
    for (const dependency of graph.get(id)?.dependencies ?? []) {
      visitComponent(dependency.id);
    }
    stack.pop();
    state.set(id, "done");
  };

  for (const id of graph.keys()) {
    visitComponent(id);
  }

  return diagnostics;
}

export function resolveComponent({
  models,
  reference,
}: {
  readonly models: ReadonlyMap<string, SourceModel>;
  readonly reference: SymbolReference;
}) {
  return resolveDeclaration({
    getDeclaration: (model, name) => model.components.get(name),
    models,
    reference,
  });
}

export function resolveStore({
  models,
  reference,
}: {
  readonly models: ReadonlyMap<string, SourceModel>;
  readonly reference: SymbolReference;
}) {
  return resolveDeclaration({
    getDeclaration: (model, name) => model.stores.get(name),
    models,
    reference,
  });
}

export function unresolvedReferenceDiagnostic(
  reference: SymbolReference,
  kind: string,
) {
  return {
    code: "unresolved-analysis-reference",
    fileName: reference.fileName,
    location: reference.location,
    message: `Unable to resolve ${kind} "${reference.name}" while analyzing Effect React requirements.`,
  } satisfies EffectReactDiagnostic;
}

function collectDirectRequirements({
  component,
  diagnostics,
  models,
}: {
  readonly component: GraphComponent;
  readonly diagnostics: EffectReactDiagnostic[];
  readonly models: ReadonlyMap<string, SourceModel>;
}) {
  for (const reference of component.declaration.serviceReferences) {
    const store = resolveStore({ models, reference });
    if (store) {
      component.directRequirements.add(store.serviceName);
    } else {
      diagnostics.push(
        unresolvedReferenceDiagnostic(reference, "store service"),
      );
    }
  }
}

function collectDependencies({
  component,
  diagnostics,
  models,
}: {
  readonly component: GraphComponent;
  readonly diagnostics: EffectReactDiagnostic[];
  readonly models: ReadonlyMap<string, SourceModel>;
}) {
  for (const reference of component.declaration.childReferences) {
    const child = resolveComponent({ models, reference: reference.component });
    if (child) {
      const providedRequirements = new Set<string>();
      for (const providerReference of reference.providers) {
        const store = resolveStore({ models, reference: providerReference });
        if (store) {
          providedRequirements.add(store.serviceName);
          component.providedRequirements.add(store.serviceName);
        } else {
          diagnostics.push(
            unresolvedReferenceDiagnostic(providerReference, "provider store"),
          );
        }
      }
      component.dependencies.push({
        id: symbolId(child.fileName, child.name),
        providedRequirements,
      });
    }
  }
}

function reportCycle({
  diagnostics,
  graph,
  id,
  reported,
  stack,
}: {
  readonly diagnostics: EffectReactDiagnostic[];
  readonly graph: ReadonlyMap<string, GraphComponent>;
  readonly id: string;
  readonly reported: Set<string>;
  readonly stack: readonly string[];
}) {
  const cycleStart = stack.indexOf(id);
  const cycle = [...stack.slice(cycleStart), id];
  const key = [...new Set(cycle)].sort().join("|");
  if (reported.has(key)) {
    return;
  }

  reported.add(key);
  const component = graph.get(id);
  if (!component) {
    return;
  }

  diagnostics.push({
    code: "component-cycle",
    fileName: component.declaration.fileName,
    location: component.declaration.location,
    message: `Effect component cycle detected: ${cycle
      .map(
        (componentId) =>
          graph.get(componentId)?.declaration.name ?? componentId,
      )
      .join(" -> ")}.`,
  });
}

function resolveDeclaration<Declaration>({
  getDeclaration,
  models,
  reference,
}: {
  readonly getDeclaration: (
    model: SourceModel,
    name: string,
  ) => Declaration | undefined;
  readonly models: ReadonlyMap<string, SourceModel>;
  readonly reference: SymbolReference;
}) {
  const visited = new Set<string>();
  let current = { fileName: reference.fileName, name: reference.name };

  while (true) {
    const key = symbolId(current.fileName, current.name);
    if (visited.has(key)) {
      return undefined;
    }
    visited.add(key);

    const model = models.get(current.fileName);
    if (!model) {
      return undefined;
    }

    const declaration = getDeclaration(model, current.name);
    if (declaration) {
      return declaration;
    }

    const imported = model.imports.get(current.name);
    if (imported) {
      current = {
        fileName: imported.fileName,
        name: imported.exportedName,
      };
      continue;
    }

    const exported = model.exports.get(current.name);
    if (exported) {
      current = { fileName: exported.fileName, name: exported.name };
      continue;
    }

    return undefined;
  }
}

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  return (
    left.size === right.size && [...left].every((value) => right.has(value))
  );
}
