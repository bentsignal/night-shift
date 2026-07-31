import type { ComponentType } from "react";
import { Effect } from "effect";

import type {
  Component,
  ComponentEffect,
  ComponentWithProps,
  ReadableStore,
  StoreRequirement,
} from "../src";
import { createComponent, createStore, useStore } from "../src";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;
type Requirements<Value> = Effect.Effect.Context<ComponentEffect<Value>>;

declare const dynamicStoreName: string;
// @ts-expect-error store identity must be one string literal
createStore(dynamicStoreName);

declare const unionStoreName: "First" | "Second";
// @ts-expect-error one declaration cannot represent multiple store identities
createStore(unionStoreName);

const Stateless = createComponent<{ label: string }>({
  ui: ({ props }) => {
    props.label satisfies string;
    return null;
  },
});
Stateless satisfies ComponentWithProps<{ label: string }>;
Stateless satisfies ComponentType<{ label: string }>;

createComponent({
  ui: (input) => {
    // @ts-expect-error stateless UI has no state field
    const _state = input.state;
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

const first = createStore("TypedFirst")<FirstState>();
const second = createStore("TypedSecond")<SecondState>();

// @ts-expect-error createStore exposes a store dependency and provider, not a service
const _RemovedService = first.service;
// @ts-expect-error store selection is performed through the shared useStore hook
const _RemovedHook = first.useStore;

first.store satisfies {
  readonly key: string;
};

const Consumer = createComponent({
  deps: [first.store, second.store],
  state: ({ deps: [firstStore, secondStore] }) => {
    firstStore satisfies ReadableStore<FirstState>;
    secondStore satisfies ReadableStore<SecondState>;
    return {
      count: useStore(firstStore, (state) => state.count),
      label: useStore(secondStore, (state) => state.label),
    };
  },
  ui: ({ state }) => {
    state.count satisfies number;
    state.label satisfies string;
    return null;
  },
});

type FirstRequirement = StoreRequirement<"TypedFirst", FirstState>;
type SecondRequirement = StoreRequirement<"TypedSecond", SecondState>;

Consumer satisfies Component<FirstRequirement | SecondRequirement>;
type _ConsumerRequirements = Expect<
  Equal<Requirements<typeof Consumer>, FirstRequirement | SecondRequirement>
>;

const Boundary = createComponent({ ui: () => null });
const _FirstProvided = Boundary.__effectReactProvidedRequirements(
  [first.Store],
  Consumer,
);
const _BothProvided = Boundary.__effectReactProvidedRequirements(
  [first.Store, second.Store],
  Consumer,
);

type _FirstProvidedRequirements = Expect<
  Equal<Requirements<typeof _FirstProvided>, SecondRequirement>
>;
type _BothProvidedRequirements = Expect<
  Equal<Requirements<typeof _BothProvided>, never>
>;

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
