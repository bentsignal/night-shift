import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";

import { createComponent, createStore, useStore } from "../src";

export interface CounterState {
  readonly count: number;
  readonly setCount: Dispatch<SetStateAction<number>>;
}

export const Counter = createStore("Counter")<CounterState>();

export function useCounterImplementation() {
  const [count, setCount] = useState(0);
  return { count, setCount };
}

export const CounterButton = createComponent({
  displayName: "CounterButton",

  deps: [Counter],

  state: ({ deps }) => {
    const count = useStore(deps.counter, (state) => state.count);
    const setCount = useStore(deps.counter, (state) => state.setCount);

    // eslint-disable-next-line no-restricted-syntax -- Effect components still support ordinary React hooks when they are the right tool.
    useEffect(() => {
      console.log("test effect");
    }, []);

    return {
      count,
      increment: () => setCount((current) => current + 1),
    };
  },

  ui: ({ state }) => (
    <button type="button" onClick={state.increment}>
      Count: {state.count}
    </button>
  ),
});

export const CounterRow = createComponent({
  ui: () => (
    <div>
      <span>Nested counter</span>
      <CounterButton />
    </div>
  ),
});

export const CounterPanel = createComponent({
  ui: () => (
    // <Counter implements={useCounterImplementation}>
    <section>
      <h2>Counter panel</h2>
      <CounterRow />
    </section>
    // </Counter>
  ),
});

export const CounterExample = createComponent({
  ui: () => (
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
