import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { Effect } from "effect";

import { createComponent, createStore, requireComponent } from "../src";

export interface CounterState {
  readonly count: number;
  readonly setCount: Dispatch<SetStateAction<number>>;
}

export const counter = createStore("Counter")<CounterState>();

export const CounterButton = createComponent({
  displayName: "CounterButton",

  state: Effect.gen(function* () {
    const useCounter = yield* counter.service;

    return function useCounterButtonState() {
      const count = useCounter((store) => store.count);
      const setCount = useCounter((store) => store.setCount);

      // eslint-disable-next-line no-restricted-syntax -- Effect components still support ordinary React hooks when they are the right tool.
      useEffect(() => {
        console.log("test effect");
      }, []);

      return Effect.succeed({
        count,
        increment: () => setCount((current) => current + 1),
      });
    };
  }),

  component: ({ state }) => (
    <button type="button" onClick={state.increment}>
      Count: {state.count}
    </button>
  ),
});

export const CounterRow = createComponent({
  state: Effect.gen(function* () {
    const Button = yield* requireComponent(CounterButton);
    return () => Effect.succeed({ Button });
  }),

  component: ({ state }) => (
    <div>
      <span>Nested counter</span>
      <state.Button />
    </div>
  ),
});

export const CounterPanel = createComponent({
  state: Effect.gen(function* () {
    const Row = yield* requireComponent(CounterRow);
    return () => Effect.succeed({ Row });
  }),

  component: ({ state }) => (
    <section>
      <h2>Counter panel</h2>
      <state.Row />
    </section>
  ),
});

export const ProvidedCounterPanel = counter.provide({
  component: CounterPanel,
  implementation: function useCounterImplementation() {
    const [count, setCount] = useState(0);
    return { count, setCount };
  },
});

export const CounterExample = createComponent({
  state: Effect.gen(function* () {
    const Panel = yield* requireComponent(ProvidedCounterPanel);
    return () => Effect.succeed({ Panel });
  }),

  component: ({ state }) => (
    <main>
      <state.Panel />
    </main>
  ),
});
