import analysis from "virtual:effect-react-analysis";

import { createComponent } from "@night-shift/effect-react";

const root = analysis.components.find(
  (component) => component.name === "EffectLab",
);
const componentById = new Map(
  analysis.components.map((component) => [component.id, component]),
);
const nodes = root
  ? [
      {
        kind: "react",
        label: "toReactComponent(EffectLab)",
        note: "React root",
      },
      ...walkComponents(root.id).map((component) => ({
        kind: component.providedRequirements.length > 0 ? "provider" : "effect",
        label: component.name,
        note: describeComponent(component),
      })),
    ]
  : [];

export const RuntimeTrace = createComponent({
  state: () => ({
    nodes,
    unresolved: root?.requirements.length ?? analysis.diagnostics.length,
  }),
  ui: ({ state }) => (
    <aside aria-labelledby="trace-title" className="trace">
      <div className="trace-heading">
        <p className="eyebrow">runtime trace</p>
        <h2 id="trace-title">Dependency path</h2>
      </div>

      <ol className="trace-list">
        {state.nodes.map((node, index) => (
          <li className={`trace-node trace-node-${node.kind}`} key={node.label}>
            <span className="trace-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="trace-node-copy">
              <strong>{node.label}</strong>
              <small>{node.note}</small>
            </span>
          </li>
        ))}
      </ol>

      <div className="trace-result">
        <span>Unresolved requirements</span>
        <strong>{state.unresolved}</strong>
      </div>
    </aside>
  ),
});

function walkComponents(rootId: string) {
  const visited = new Set<string>();
  const ordered = analysis.components.slice(0, 0);

  const visit = (componentId: string) => {
    if (visited.has(componentId)) {
      return;
    }
    visited.add(componentId);

    const component = componentById.get(componentId);
    if (!component) {
      return;
    }
    ordered.push(component);
    component.dependencies.forEach(visit);
  };

  visit(rootId);
  return ordered;
}

function describeComponent(component: (typeof analysis.components)[number]) {
  if (component.providedRequirements.length > 0) {
    return `provides ${component.providedRequirements.join(", ")}`;
  }
  if (component.directRequirements.length > 0) {
    return `requires ${component.directRequirements.join(", ")}`;
  }
  return "Effect component";
}
