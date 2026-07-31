import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";

import { createComponent, createStore, useStore } from "../src";

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

  deps: [counter.store],

  state: ({ deps }) => {
    const [store] = deps;
    const count = useStore(store, (state) => state.count);
    const setCount = useStore(store, (state) => state.setCount);

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
    // <counter.Store implements={useCounterImplementation}>
    <section>
      <h2>Counter panel</h2>
      <CounterRow />
    </section>
    // </counter.Store>
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
