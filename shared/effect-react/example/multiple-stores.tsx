import { useState } from "react";

import { createComponent, createStore, useStore } from "../src";

export interface ViewerState {
  readonly name: string;
  readonly setName: (name: string) => void;
}

export interface ThemeState {
  readonly accent: "amber" | "cyan" | "violet";
  readonly cycleAccent: () => void;
}

export interface WorkspaceState {
  readonly count: number;
  readonly decrement: () => void;
  readonly increment: () => void;
  readonly project: string;
  readonly reset: () => void;
}

export const Viewer = createStore("Viewer")<ViewerState>();
export const Theme = createStore("Theme")<ThemeState>();
export const Workspace = createStore("Workspace")<WorkspaceState>();

function useViewerImplementation() {
  const [name, setName] = useState("Ada");

  return { name, setName };
}

function useThemeImplementation() {
  const [accent, setAccent] = useState<ThemeState["accent"]>("violet");

  return {
    accent,
    cycleAccent: () => {
      setAccent((current) => {
        if (current === "violet") return "amber";
        if (current === "amber") return "cyan";
        return "violet";
      });
    },
  };
}

function useWorkspaceImplementation() {
  const [count, setCount] = useState(3);

  return {
    count,
    decrement: () => setCount((current) => Math.max(0, current - 1)),
    increment: () => setCount((current) => current + 1),
    project: "Night Shift",
    reset: () => setCount(0),
  };
}

// A single component can consume several stores through one named deps object.
export const IdentityBadge = createComponent({
  deps: [Viewer, Theme],
  state: ({ deps }) => ({
    accent: useStore(deps.theme, (state) => state.accent),
    cycleAccent: useStore(deps.theme, (state) => state.cycleAccent),
    name: useStore(deps.viewer, (state) => state.name),
    setName: useStore(deps.viewer, (state) => state.setName),
  }),
  ui: ({ state }) => (
    <div className="store-card identity-store" data-accent={state.accent}>
      <div className="store-card-heading">
        <span>Viewer + Theme</span>
        <button onClick={state.cycleAccent} type="button">
          Change accent
        </button>
      </div>
      <label htmlFor="viewer-name">Operator</label>
      <input
        id="viewer-name"
        onChange={(event) => state.setName(event.currentTarget.value)}
        value={state.name}
      />
      <div className="transform-output">
        <small>Uppercase signal</small>
        <output aria-label="Transformed operator">
          {state.name.trim().toUpperCase() || "ANONYMOUS"}
        </output>
        <span aria-label="Current accent">{state.accent}</span>
      </div>
    </div>
  ),
});

export const WorkspaceLabel = createComponent({
  deps: [Workspace],
  state: ({ deps }) => ({
    count: useStore(deps.workspace, (state) => state.count),
    decrement: useStore(deps.workspace, (state) => state.decrement),
    increment: useStore(deps.workspace, (state) => state.increment),
    project: useStore(deps.workspace, (state) => state.project),
    reset: useStore(deps.workspace, (state) => state.reset),
  }),
  ui: ({ state }) => (
    <div className="store-card workspace-store">
      <div className="store-card-heading">
        <span>Workspace</span>
        <strong>{state.project}</strong>
      </div>
      <output aria-label="Build count">
        {String(state.count).padStart(2, "0")}
      </output>
      <div className="workspace-controls">
        <button aria-label="Decrease build count" onClick={state.decrement}>
          −
        </button>
        <button onClick={state.reset}>Reset</button>
        <button aria-label="Increase build count" onClick={state.increment}>
          +
        </button>
      </div>
    </div>
  ),
});

// Viewer, Theme, and Workspace all bubble through this ordinary JSX boundary.
export const UnprovidedDashboard = createComponent({
  ui: () => (
    <section className="multi-store-dashboard">
      <IdentityBadge />
      <WorkspaceLabel />
    </section>
  ),
});

// Supplying Viewer removes only Viewer; Theme and Workspace keep bubbling.
export const ViewerProvidedDashboard = createComponent({
  ui: () => (
    <Viewer implements={useViewerImplementation}>
      <UnprovidedDashboard />
    </Viewer>
  ),
});

// A provider can be introduced at a higher component boundary.
export const ViewerAndThemeProvidedDashboard = createComponent({
  ui: () => (
    <Theme implements={useThemeImplementation}>
      <ViewerProvidedDashboard />
    </Theme>
  ),
});

// The final provider satisfies the last requirement at the outermost level.
export const FullyProvidedDashboard = createComponent({
  ui: () => (
    <Workspace implements={useWorkspaceImplementation}>
      <ViewerAndThemeProvidedDashboard />
    </Workspace>
  ),
});
