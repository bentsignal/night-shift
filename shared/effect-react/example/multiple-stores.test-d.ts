import type { Effect } from "effect";

import type { ComponentEffect, StoreRequirement } from "../src";
import type {
  ThemeState,
  ViewerState,
  WorkspaceState,
} from "./multiple-stores";
import {
  FullyProvidedDashboard,
  IdentityBadge,
  UnprovidedDashboard,
  ViewerAndThemeProvidedDashboard,
  ViewerProvidedDashboard,
} from "./multiple-stores";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;

type Requirements<Component> = Effect.Effect.Context<
  ComponentEffect<Component>
>;

type ViewerRequirement = StoreRequirement<"Viewer", ViewerState>;
type ThemeRequirement = StoreRequirement<"Theme", ThemeState>;
type WorkspaceRequirement = StoreRequirement<"Workspace", WorkspaceState>;

type _OneComponentCanRequireTwoStores = Expect<
  Equal<
    Requirements<typeof IdentityBadge>,
    ViewerRequirement | ThemeRequirement
  >
>;
type _NestedChildrenBubbleAllThree = Expect<
  Equal<
    Requirements<typeof UnprovidedDashboard>,
    ViewerRequirement | ThemeRequirement | WorkspaceRequirement
  >
>;
type _ProvidingViewerLeavesTwo = Expect<
  Equal<
    Requirements<typeof ViewerProvidedDashboard>,
    ThemeRequirement | WorkspaceRequirement
  >
>;
type _ProvidingViewerAndThemeLeavesWorkspace = Expect<
  Equal<
    Requirements<typeof ViewerAndThemeProvidedDashboard>,
    WorkspaceRequirement
  >
>;
type _ProvidingAllThreeLeavesNothing = Expect<
  Equal<Requirements<typeof FullyProvidedDashboard>, never>
>;
