import type { FunctionComponent } from "react";
import { Effect } from "effect";

import type {
  Component,
  ComponentEffect,
  ComponentRequirements,
  ComponentWithProps,
  ReadableStore,
  StoreRequirement,
} from "../src";
import {
  createComponent,
  createStore,
  defineProps,
  toStandaloneComponent,
  useStore,
} from "../src";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;
type Requirements<Value> = Effect.Services<ComponentEffect<Value>>;

const Propful = createComponent({
  props: defineProps<{ label: string }>(),
  state: ({ props }) => ({
    label: props.label,
  }),
  ui: ({ state }) => {
    state.label satisfies string;
    return null;
  },
});
Propful satisfies ComponentWithProps<{ label: string }>;
Propful satisfies FunctionComponent<{ label: string }>;
const _PropfulUsage = <Propful label="Ready" />;
// @ts-expect-error propful components require their declared props
const _MissingProp = <Propful />;
// @ts-expect-error propful components reject undeclared props
const _ExtraProp = <Propful extra label="Ready" />;

createComponent({
  props: defineProps<{ label: string }>(),
  state: ({ props }) => ({
    label: props.label,
  }),
  ui: (input) => {
    // @ts-expect-error props are consumed by state and are not exposed to ui
    void input.props;
    return null;
  },
});

createComponent({
  // @ts-expect-error components with props must derive render state
  props: defineProps<{ label: string }>(),
  ui: () => null,
});

createComponent({
  // @ts-expect-error stateless UI cannot request an input
  ui: (_input: { readonly state: unknown }) => null,
});

const Stateless = createComponent({ ui: () => null });
Stateless satisfies Component<ComponentRequirements<never>>;
const _StatelessUsage = <Stateless />;
const StatelessReactComponent = toStandaloneComponent(Stateless);
StatelessReactComponent satisfies FunctionComponent<Record<string, never>>;
const _StatelessReactUsage = <StatelessReactComponent />;
// @ts-expect-error stateless components do not accept props
const _StatelessProp = <Stateless label="Ready" />;

createComponent({
  // @ts-expect-error stateless UI cannot request a state parameter
  ui: ({ state }) => {
    void state;
    return null;
  },
});

const Stateful = createComponent({
  state: () => ({ count: 1 }),
  ui: ({ state }) => {
    state.count satisfies number;
    return null;
  },
});
Stateful satisfies Component;

createComponent({
  state: () => ({ ready: true }),
  ui: ({ state }) => {
    state.ready satisfies boolean;
    return null;
  },
});

interface FirstState {
  readonly count: number;
}

interface SecondState {
  readonly label: string;
}

const First = createStore<FirstState>();
const Second = createStore<SecondState>();

// @ts-expect-error createStore returns only the unified store value
const _RemovedService = First.service;
// @ts-expect-error store selection is performed through the shared useStore hook
const _RemovedHook = First.useStore;
// @ts-expect-error the provider is the returned store value itself
const _RemovedProviderProperty = First.Store;
// @ts-expect-error the dependency is the returned store value itself
const _RemovedDependencyProperty = First.store;

First satisfies {
  readonly key: string;
};

const Consumer = createComponent({
  deps: [First, Second],
  state: ({ deps }) => {
    deps.first satisfies ReadableStore<FirstState>;
    deps.second satisfies ReadableStore<SecondState>;
    // @ts-expect-error resolved dependencies expose only declared keys
    void deps.missing;
    return {
      count: useStore(deps.first, (state) => state.count),
      label: useStore(deps.second, (state) => state.label),
    };
  },
  ui: ({ state }) => {
    state.count satisfies number;
    state.label satisfies string;
    return null;
  },
});

type FirstRequirement = StoreRequirement<"First", FirstState>;
type SecondRequirement = StoreRequirement<"Second", SecondState>;

Consumer satisfies Component<
  ComponentRequirements<FirstRequirement | SecondRequirement>
>;
type _ConsumerRequirements = Expect<
  Equal<Requirements<typeof Consumer>, FirstRequirement | SecondRequirement>
>;

const PropfulConsumer = createComponent({
  props: defineProps<{ readonly multiplier: number }>(),
  deps: [First, Second],
  state: ({ deps, props }) => ({
    count: useStore(deps.first, (state) => state.count) * props.multiplier,
    label: useStore(deps.second, (state) => state.label),
  }),
  ui: ({ state }) => {
    state.count satisfies number;
    state.label satisfies string;
    return null;
  },
});

PropfulConsumer satisfies ComponentWithProps<
  { readonly multiplier: number },
  ComponentRequirements<FirstRequirement | SecondRequirement>
>;
const _PropfulConsumerUsage = <PropfulConsumer multiplier={2} />;
// @ts-expect-error unresolved requirements cannot cross into ordinary React
toStandaloneComponent(PropfulConsumer);
type _PropfulConsumerRequirements = Expect<
  Equal<
    Requirements<typeof PropfulConsumer>,
    FirstRequirement | SecondRequirement
  >
>;

const Boundary = createComponent({ ui: () => null });
const _FirstProvided = Boundary.__effectReactProvidedRequirements(
  [First],
  Consumer,
);
const _BothProvided = Boundary.__effectReactProvidedRequirements(
  [First, Second],
  Consumer,
);

type _FirstProvidedRequirements = Expect<
  Equal<Requirements<typeof _FirstProvided>, SecondRequirement>
>;
type _BothProvidedRequirements = Expect<
  Equal<Requirements<typeof _BothProvided>, never>
>;

const ReactBoundary = toStandaloneComponent(_BothProvided);
ReactBoundary satisfies FunctionComponent<Record<string, never>>;
// @ts-expect-error unresolved requirements must be provided before conversion
toStandaloneComponent(Consumer);

const UnresolvedRoot = createComponent({
  ui: () => <Consumer />,
});
// @ts-expect-error a child requirement bubbles into the route boundary
toStandaloneComponent(UnresolvedRoot);

const ResolvedRoot = createComponent({
  ui: () => (
    <First implements={() => ({ count: 0 })}>
      <Second implements={() => ({ label: "Ready" })}>
        <Consumer />
      </Second>
    </First>
  ),
});
const ResolvedReactRoot = toStandaloneComponent(ResolvedRoot);
ResolvedReactRoot satisfies FunctionComponent<Record<string, never>>;

const PropfulReactComponent = toStandaloneComponent(Propful);
PropfulReactComponent satisfies FunctionComponent<{ label: string }>;
const _PropfulReactUsage = <PropfulReactComponent label="Ready" />;

const effectAction = Effect.succeed("done");
createComponent({
  state: () => ({ effectAction }),
  ui: ({ state }) => {
    state.effectAction satisfies Effect.Effect<string>;
    return null;
  },
});

createComponent({
  // @ts-expect-error dependencies must be stores created by createStore
  deps: [Effect.succeed("not-a-store")],
  ui: () => null,
});
