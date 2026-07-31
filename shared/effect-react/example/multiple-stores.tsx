import { Effect } from "effect";

import { createComponent, createStore, useStoreSelector } from "../src";

export interface FirstState {
  readonly value: number;
}

export interface SecondState {
  readonly label: string;
}

export const first = createStore("First")<FirstState>();
export const second = createStore("Second")<SecondState>();

function useFirstImplementation() {
  return { value: 1 };
}

function useSecondImplementation() {
  return { label: "second" };
}

const FirstValue = createComponent({
  deps: Effect.gen(function* () {
    return { store: yield* first.service };
  }),
  state: ({ deps }) =>
    Effect.succeed({
      value: useStoreSelector(deps.store, (state) => state.value),
    }),
  ui: ({ state }) => <span>{state.value}</span>,
});

const SecondValue = createComponent({
  deps: Effect.gen(function* () {
    return { store: yield* second.service };
  }),
  state: ({ deps }) =>
    Effect.succeed({
      label: useStoreSelector(deps.store, (state) => state.label),
    }),
  ui: ({ state }) => <span>{state.label}</span>,
});

export const UnprovidedPair = createComponent({
  state: () => Effect.succeed({}),
  ui: () => (
    <>
      <FirstValue />
      <SecondValue />
    </>
  ),
});

export const FirstProvidedPair = createComponent({
  state: () => Effect.succeed({}),
  ui: () => (
    <first.Store implements={useFirstImplementation}>
      <FirstValue />
      <SecondValue />
    </first.Store>
  ),
});

export const BothProvidedPair = createComponent({
  state: () => Effect.succeed({}),
  ui: () => (
    <first.Store implements={useFirstImplementation}>
      <second.Store implements={useSecondImplementation}>
        <FirstValue />
        <SecondValue />
      </second.Store>
    </first.Store>
  ),
});
