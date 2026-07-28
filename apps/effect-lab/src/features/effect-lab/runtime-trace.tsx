import { Effect } from "effect";

import { createComponent } from "@night-shift/effect-react";

const nodes = [
  { kind: "react", label: "Route", note: "React" },
  { kind: "effect", label: "EffectLab", note: "Effect" },
  { kind: "effect", label: "WorkspaceFrame", note: "Effect" },
  { kind: "provider", label: "Counter provider", note: "provides" },
  { kind: "effect", label: "CounterInstrument", note: "Effect" },
  { kind: "service", label: "Readout + controls", note: "uses" },
] as const;

export const RuntimeTrace = createComponent({
  displayName: "RuntimeTrace",
  state: Effect.succeed(() => Effect.succeed({ nodes })),
  component: ({ state }) => (
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
        <span>Counter requirement</span>
        <strong>resolved</strong>
      </div>
    </aside>
  ),
});
