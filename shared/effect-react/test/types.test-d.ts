import type { ComponentType } from "react";
import { Context, Effect } from "effect";

import type { CounterState } from "../example/counter";
import type { ComponentEffect, ReadableStore, StoreRequirement } from "../src";
import { CounterButton, CounterExample } from "../example/counter";
import { createComponent, createStore, useStoreSelector } from "../src";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;

declare const dynamicStoreName: string;
// @ts-expect-error store identity must be one string literal
createStore(dynamicStoreName);

declare const unionStoreName: "First" | "Second";
// @ts-expect-error one declaration cannot represent multiple service identities
createStore(unionStoreName);

type CounterRequirement = StoreRequirement<"Counter", CounterState>;
type _CounterButtonRequirement = Expect<
  Equal<
    Effect.Effect.Context<ComponentEffect<typeof CounterButton>>,
    CounterRequirement
  >
>;
type _CounterExampleRequirement = Expect<
  Equal<
    Effect.Effect.Context<ComponentEffect<typeof CounterExample>>,
    CounterRequirement
  >
>;

class NumberService extends Context.Tag("NumberService")<
  NumberService,
  number
>() {}

class TextService extends Context.Tag("TextService")<TextService, string>() {}

const requiredDeps = Effect.gen(function* () {
  const number = yield* NumberService;
  const text = yield* TextService;
  return { number, text };
});

const Required = createComponent({
  deps: requiredDeps,
  state: ({ deps }) => Effect.succeed({ label: `${deps.text}:${deps.number}` }),
  ui: ({ props, state }) => {
    props satisfies Record<string, never>;
    state.label satisfies string;
    return null;
  },
});

Required satisfies ComponentType;
type RequiredEffect = ComponentEffect<typeof Required>;
type RequiredServices = Effect.Effect.Context<RequiredEffect>;
type _RequiredServices = Expect<
  Equal<RequiredServices, NumberService | TextService>
>;

const Ready = createComponent({
  deps: requiredDeps.pipe(
    Effect.provideService(NumberService, 1),
    Effect.provideService(TextService, "ready"),
  ),
  state: ({ deps }) => Effect.succeed({ label: `${deps.text}:${deps.number}` }),
  ui: ({ state }) => {
    state.label satisfies string;
    return null;
  },
});

Ready satisfies ComponentType;
type ReadyEffect = ComponentEffect<typeof Ready>;
type _ReadyServices = Expect<Equal<Effect.Effect.Context<ReadyEffect>, never>>;

const Failed = createComponent({
  deps: Effect.fail("typed-failure" as const),
  state: () => Effect.succeed({ ready: false }),
  ui: ({ state }) => {
    state.ready satisfies boolean;
    return null;
  },
  onFailure: (error) => {
    error satisfies "typed-failure";
    return null;
  },
});

Failed satisfies ComponentType;

const StateFailed = createComponent({
  state: () => Effect.fail("state-failure" as const),
  ui: () => null,
  onFailure: (error) => {
    error satisfies "state-failure";
    return null;
  },
});

StateFailed satisfies ComponentType;

createComponent({
  state: () => Effect.succeed({ ready: true }),
  // @ts-expect-error views render JSX or null, not arbitrary React nodes
  ui: () => "business logic leaked into the view",
});

interface TypedCounterState {
  readonly count: number;
}

const typedStore = createStore("TypedCounter")<TypedCounterState>();
const otherTypedStore = createStore("OtherTypedCounter")<TypedCounterState>();

typedStore.service satisfies Context.Tag<
  StoreRequirement<"TypedCounter", TypedCounterState>,
  ReadableStore<TypedCounterState>
>;
// @ts-expect-error selectors are obtained by yielding the Effect service
const _RemovedUseStore = typedStore.useStore;
// @ts-expect-error implementations enter through the Store component
const _RemovedProvide = typedStore.provide;

const _StoreConsumer = createComponent({
  deps: Effect.gen(function* () {
    const typedStoreHandle = yield* typedStore.service;
    const otherTypedStoreHandle = yield* otherTypedStore.service;
    const offset = yield* NumberService;
    return { offset, otherTypedStoreHandle, typedStoreHandle };
  }),
  state: ({ deps }) =>
    Effect.succeed({
      count:
        useStoreSelector(deps.typedStoreHandle, (state) => state.count) +
        useStoreSelector(deps.otherTypedStoreHandle, (state) => state.count) +
        deps.offset,
    }),
  ui: ({ state }) => {
    state.count satisfies number;
    return null;
  },
});

type StoreConsumerEffect = ComponentEffect<typeof _StoreConsumer>;
type _StoreRequirement = Expect<
  Equal<
    Effect.Effect.Context<StoreConsumerEffect>,
    | NumberService
    | StoreRequirement<"OtherTypedCounter", TypedCounterState>
    | StoreRequirement<"TypedCounter", TypedCounterState>
  >
>;

const _NestedConsumer = createComponent({
  deps: Effect.gen(function* () {
    const StoreConsumer = yield* _StoreConsumer;
    return { StoreConsumer };
  }),
  state: ({ deps }) => Effect.succeed({ StoreConsumer: deps.StoreConsumer }),
  ui: ({ state }) => {
    state.StoreConsumer satisfies ComponentType;
    return null;
  },
});

type NestedConsumerEffect = ComponentEffect<typeof _NestedConsumer>;
type _NestedRequirement = Expect<
  Equal<
    Effect.Effect.Context<NestedConsumerEffect>,
    | NumberService
    | StoreRequirement<"OtherTypedCounter", TypedCounterState>
    | StoreRequirement<"TypedCounter", TypedCounterState>
  >
>;

const _ProviderBoundary = createComponent({
  state: () => Effect.succeed({}),
  ui: () => null,
});
const _ProvidedConsumer = _ProviderBoundary.__effectReactProvidedRequirements(
  [typedStore.Store],
  _NestedConsumer,
);

type ProvidedConsumerEffect = ComponentEffect<typeof _ProvidedConsumer>;
type _ProvidedRequirement = Expect<
  Equal<
    Effect.Effect.Context<ProvidedConsumerEffect>,
    NumberService | StoreRequirement<"OtherTypedCounter", TypedCounterState>
  >
>;

const _OuterConsumer = createComponent({
  deps: Effect.gen(function* () {
    const ProvidedConsumer = yield* _ProvidedConsumer;
    return { ProvidedConsumer };
  }),
  state: ({ deps }) =>
    Effect.succeed({ ProvidedConsumer: deps.ProvidedConsumer }),
  ui: ({ state }) => {
    state.ProvidedConsumer satisfies ComponentType;
    return null;
  },
});

type OuterConsumerEffect = ComponentEffect<typeof _OuterConsumer>;
type _OuterRequirement = Expect<
  Equal<
    Effect.Effect.Context<OuterConsumerEffect>,
    NumberService | StoreRequirement<"OtherTypedCounter", TypedCounterState>
  >
>;
