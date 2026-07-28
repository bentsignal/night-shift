import type { ComponentType } from "react";
import { Context, Effect } from "effect";

import type { ComponentEffect, StoreRequirement } from "../src";
import { createComponent, createStore } from "../src";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;

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

const typedStore = createStore({
  name: "TypedCounter",
  state: () => ({ count: 0 }),
});

typedStore.service satisfies Context.Tag<
  StoreRequirement<"TypedCounter">,
  typeof typedStore.useStore
>;

const _StoreConsumer = createComponent({
  state: Effect.gen(function* () {
    const useTypedStore = yield* typedStore.service;
    return () =>
      Effect.succeed({
        count: useTypedStore((state) => state.count),
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
    StoreRequirement<"TypedCounter">
  >
>;
