import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

import {
  createComponent,
  createStore,
  useStore,
} from "@night-shift/effect-react";

export interface CounterState {
  readonly count: number;
  readonly setCount: Dispatch<SetStateAction<number>>;
}

export const Counter = createStore<CounterState>();

function useCounterImplementation() {
  const [count, setCount] = useState(5);
  return { count, setCount };
}

export const CounterReadout = createComponent({
  deps: [Counter],

  state: ({ deps }) => ({
    count: useStore(deps.counter, (state) => state.count),
  }),

  ui: ({ state }) => (
    <output aria-live="polite" className="counter-value">
      {formatCount(state.count)}
    </output>
  ),
});

export const CounterControls = createComponent({
  deps: [Counter],

  state: ({ deps }) => {
    const setCount = useStore(deps.counter, (state) => state.setCount);
    return {
      decrement: () => setCount((current) => current - 1),
      increment: () => setCount((current) => current + 1),
      reset: () => setCount(0),
    };
  },

  ui: ({ state }) => (
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
  ui: () => (
    <Counter implements={useCounterImplementation}>
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
    </Counter>
  ),
});

export const TestComponent = createComponent({
  ui: () => (
    <div>
      <CounterControls />
    </div>
  ),
});

function formatCount(count: number) {
  const magnitude = Math.abs(count).toString().padStart(2, "0");
  return count < 0 ? `−${magnitude}` : `+${magnitude}`;
}
