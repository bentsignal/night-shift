import type { ComponentType } from "react";
import { Context, Effect } from "effect";

import type { CounterState } from "../example/counter";
import type { ComponentEffect, StoreRequirement } from "../src";
import {
  CounterButton,
  CounterExample,
  CounterPanel,
  CounterRow,
  ProvidedCounterPanel,
} from "../example/counter";
import { createComponent, createStore, requireComponent } from "../src";

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
type _CounterRowRequirement = Expect<
  Equal<
    Effect.Effect.Context<ComponentEffect<typeof CounterRow>>,
    CounterRequirement
  >
>;
type _CounterPanelRequirement = Expect<
  Equal<
    Effect.Effect.Context<ComponentEffect<typeof CounterPanel>>,
    CounterRequirement
  >
>;
type _ProvidedCounterPanelRequirement = Expect<
  Equal<
    Effect.Effect.Context<ComponentEffect<typeof ProvidedCounterPanel>>,
    never
  >
>;
type _CounterExampleRequirement = Expect<
  Equal<Effect.Effect.Context<ComponentEffect<typeof CounterExample>>, never>
>;

class NumberService extends Context.Tag("NumberService")<
  NumberService,
  number
>() {}

class TextService extends Context.Tag("TextService")<TextService, string>() {}

const requiredState = Effect.gen(function* () {
  const number = yield* NumberService;
  const text = yield* TextService;
  return () => Effect.succeed({ label: `${text}:${number}` });
});

const Required = createComponent({
  state: requiredState,
  component: ({ props, state }) => {
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
  state: requiredState.pipe(
    Effect.provideService(NumberService, 1),
    Effect.provideService(TextService, "ready"),
  ),
  component: ({ state }) => {
    state.label satisfies string;
    return null;
  },
});

Ready satisfies ComponentType;
type ReadyEffect = ComponentEffect<typeof Ready>;
type _ReadyServices = Expect<Equal<Effect.Effect.Context<ReadyEffect>, never>>;

const Failed = createComponent({
  state: Effect.fail("typed-failure" as const).pipe(
    Effect.as(() => Effect.succeed({ ready: false })),
  ),
  component: ({ state }) => {
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
  state: Effect.succeed(() => Effect.fail("state-failure" as const)),
  component: () => null,
  onFailure: (error) => {
    error satisfies "state-failure";
    return null;
  },
});

StateFailed satisfies ComponentType;

createComponent({
  state: Effect.succeed(() => Effect.succeed({ ready: true })),
  // @ts-expect-error views render JSX or null, not arbitrary React nodes
  component: () => "business logic leaked into the view",
});

interface TypedCounterState {
  readonly count: number;
}

const typedStore = createStore("TypedCounter")<TypedCounterState>();
const otherTypedStore = createStore("OtherTypedCounter")<TypedCounterState>();

typedStore.service satisfies Context.Tag<
  StoreRequirement<"TypedCounter", TypedCounterState>,
  typeof typedStore.useStore
>;

const _StoreConsumer = createComponent({
  state: Effect.gen(function* () {
    const useTypedStore = yield* typedStore.service;
    const useOtherTypedStore = yield* otherTypedStore.service;
    const offset = yield* NumberService;
    return () =>
      Effect.succeed({
        count:
          useTypedStore((state) => state.count) +
          useOtherTypedStore((state) => state.count) +
          offset,
      });
  }),
  component: ({ state }) => {
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
  state: Effect.gen(function* () {
    const StoreConsumer = yield* requireComponent(_StoreConsumer);
    return () => Effect.succeed({ StoreConsumer });
  }),
  component: ({ state }) => {
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

const _ProvidedConsumer = typedStore.provide({
  component: _NestedConsumer,
  implementation: () => ({ count: 0 }),
});

type ProvidedConsumerEffect = ComponentEffect<typeof _ProvidedConsumer>;
type _ProvidedRequirement = Expect<
  Equal<
    Effect.Effect.Context<ProvidedConsumerEffect>,
    NumberService | StoreRequirement<"OtherTypedCounter", TypedCounterState>
  >
>;

const _OuterConsumer = createComponent({
  state: Effect.gen(function* () {
    const ProvidedConsumer = yield* requireComponent(_ProvidedConsumer);
    return () => Effect.succeed({ ProvidedConsumer });
  }),
  component: ({ state }) => {
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
