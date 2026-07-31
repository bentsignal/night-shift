import { createComponent, createStore, useStore } from "../src";

export interface ViewerState {
  readonly name: string;
}

export interface ThemeState {
  readonly accent: string;
}

export interface WorkspaceState {
  readonly project: string;
}

export const Viewer = createStore("Viewer")<ViewerState>();
export const Theme = createStore("Theme")<ThemeState>();
export const Workspace = createStore("Workspace")<WorkspaceState>();

function useViewerImplementation() {
  return { name: "Ada" };
}

function useThemeImplementation() {
  return { accent: "violet" };
}

function useWorkspaceImplementation() {
  return { project: "Night Shift" };
}

// A single component can consume several stores through one named deps object.
export const IdentityBadge = createComponent({
  deps: [Viewer, Theme],
  state: ({ deps }) => ({
    accent: useStore(deps.theme, (state) => state.accent),
    name: useStore(deps.viewer, (state) => state.name),
  }),
  ui: ({ state }) => <span>{`${state.name} · ${state.accent}`}</span>,
});

export const WorkspaceLabel = createComponent({
  deps: [Workspace],
  state: ({ deps }) => ({
    project: useStore(deps.workspace, (state) => state.project),
  }),
  ui: ({ state }) => <strong>{state.project}</strong>,
});

// Viewer, Theme, and Workspace all bubble through this ordinary JSX boundary.
export const UnprovidedDashboard = createComponent({
  ui: () => (
    <section>
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
