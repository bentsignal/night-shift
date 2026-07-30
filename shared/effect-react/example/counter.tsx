import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { Effect } from "effect";

import { createComponent, createStore, useStoreSelector } from "../src";

export interface CounterState {
  readonly count: number;
  readonly setCount: Dispatch<SetStateAction<number>>;
}

export const counter = createStore("Counter")<CounterState>();

export function useCounterImplementation() {
  const [count, setCount] = useState(0);
  return { count, setCount };
}

export const CounterButton = createComponent({
  displayName: "CounterButton",

  deps: Effect.gen(function* () {
    return { store: yield* counter.service };
  }),

  state: ({ deps }) => {
    const count = useStoreSelector(deps.store, (state) => state.count);
    const setCount = useStoreSelector(deps.store, (state) => state.setCount);

    // eslint-disable-next-line no-restricted-syntax -- Effect components still support ordinary React hooks when they are the right tool.
    useEffect(() => {
      console.log("test effect");
    }, []);

    return Effect.succeed({
      count,
      increment: () => setCount((current) => current + 1),
    });
  },

  UI: ({ state }) => (
    <button type="button" onClick={state.increment}>
      Count: {state.count}
    </button>
  ),
});

export const CounterRow = createComponent({
  state: () => Effect.succeed({}),

  UI: () => (
    <div>
      <span>Nested counter</span>
      <CounterButton />
    </div>
  ),
});

export const CounterPanel = createComponent({
  state: () => Effect.succeed({}),

  UI: () => (
    // <counter.Store implements={useCounterImplementation}>
    <section>
      <h2>Counter panel</h2>
      <CounterRow />
    </section>
    // </counter.Store>
  ),
});

export const CounterExample = createComponent({
  state: () => Effect.succeed({}),

  UI: () => (
    <main>
      <CounterPanel />
    </main>
  ),
});

export function NormalComponent() {
  return (
    <div>
      <CounterExample />
    </div>
  );
}
