import { useEffect, useState } from "react";
import { Effect } from "effect";

import { createComponent, createStore } from "../src";

export const counter = createStore({
  name: "Counter",
  state: function useCounterStore() {
    const [count, setCount] = useState(0);
    return { count, setCount };
  },
});

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

export function CounterExample() {
  return (
    <counter.Store>
      <CounterButton />
    </counter.Store>
  );
}
