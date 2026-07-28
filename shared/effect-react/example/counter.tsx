import { useState } from "react";
import { Context, Effect } from "effect";

import { createComponent, createStore } from "../src";

const counter = createStore(() => {
  const [count, setCount] = useState(0);
  return { count, setCount };
});

class CounterStore extends Context.Tag("CounterStore")<
  CounterStore,
  typeof counter.useStore
>() {}

const CounterButton = createComponent({
  displayName: "CounterButton",

  state: Effect.gen(function* () {
    const useCounter = yield* CounterStore;

    return function useCounterButtonState() {
      const count = useCounter((store) => store.count);
      const setCount = useCounter((store) => store.setCount);

      return Effect.succeed({
        count,
        increment: () => setCount((current) => current + 1),
      });
    };
  }).pipe(Effect.provideService(CounterStore, counter.useStore)),

  component: ({ count, increment }) => (
    <button type="button" onClick={increment}>
      Count: {count}
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
