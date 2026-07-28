import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { Effect } from "effect";

import { createComponent, createStore } from "@night-shift/effect-react";

interface CounterState {
  readonly count: number;
  readonly setCount: Dispatch<SetStateAction<number>>;
}

export const counter = createStore("LabCounter")<CounterState>();

export const CounterReadout = createComponent({
  displayName: "CounterReadout",
  state: Effect.gen(function* () {
    const useCounter = yield* counter.service;

    return function useCounterReadout() {
      const count = useCounter((store) => store.count);
      return Effect.succeed({ count });
    };
  }),
  component: ({ state }) => (
    <output aria-live="polite" className="counter-value">
      {formatCount(state.count)}
    </output>
  ),
});

export const CounterControls = createComponent({
  displayName: "CounterControls",
  state: Effect.gen(function* () {
    const useCounter = yield* counter.service;

    return function useCounterControls() {
      const setCount = useCounter((store) => store.setCount);
      return Effect.succeed({
        decrement: () => setCount((current) => current - 1),
        increment: () => setCount((current) => current + 1),
        reset: () => setCount(0),
      });
    };
  }),
  component: ({ state }) => (
    <div className="counter-controls">
      <button
        aria-label="Decrease count"
        className="counter-step"
        type="button"
        onClick={state.decrement}
      >
        −
      </button>
      <button className="counter-reset" type="button" onClick={state.reset}>
        reset
      </button>
      <button
        aria-label="Increase count"
        className="counter-step"
        type="button"
        onClick={state.increment}
      >
        +
      </button>
    </div>
  ),
});

/**
 * Both child requirements are intended to bubble through these ordinary JSX
 * call sites. There is no `yield* ChildComponent` bookkeeping.
 */
export const CounterInstrument = createComponent({
  displayName: "CounterInstrument",
  state: Effect.succeed(() => Effect.succeed({})),
  component: () => (
    <section aria-labelledby="counter-title" className="instrument">
      <div className="instrument-heading">
        <div>
          <p className="eyebrow">live instrument</p>
          <h1 id="counter-title">Counter / 01</h1>
        </div>
        <span className="pulse-label">
          <i aria-hidden="true" />
          connected
        </span>
      </div>

      <div className="counter-stage">
        <CounterReadout />
        <span className="counter-unit">ticks</span>
      </div>

      <CounterControls />
    </section>
  ),
});

/**
 * The implementation enters halfway through the component tree. Below this
 * line the store exists; above it the Counter requirement is discharged.
 */
export const ProvidedCounterInstrument = counter.provide({
  component: CounterInstrument,
  implementation: function useCounterImplementation() {
    const [count, setCount] = useState(0);
    return { count, setCount };
  },
});

function formatCount(count: number) {
  const magnitude = Math.abs(count).toString().padStart(2, "0");
  return count < 0 ? `−${magnitude}` : `+${magnitude}`;
}
