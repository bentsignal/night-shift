import { useState } from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { createComponent, createStore, defineProps, useStore } from "../src";

describe("createComponent", () => {
  test("routes props through state before rendering UI", () => {
    const ui = vi.fn(({ state }: { state: { label: string } }) => (
      <span>{state.label}</span>
    ));
    const Label = createComponent({
      props: defineProps<{ label: string }>(),
      state: ({ props }) => ({
        label: props.label,
      }),
      ui,
    });

    render(<Label label="Ready" />);

    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(ui).toHaveBeenCalledWith({ state: { label: "Ready" } });
  });

  test("passes plain state from state to UI", () => {
    const Counter = createComponent({
      props: defineProps<{ initial: number }>(),
      state: ({ props }) => ({
        count: props.initial,
        label: `Initial ${props.initial}`,
      }),
      ui: ({ state }) => <span>{`${state.label}: ${state.count}`}</span>,
    });

    render(<Counter initial={42} />);

    expect(screen.getByText("Initial 42: 42")).toBeInTheDocument();
  });

  test("publishes hot definitions through a stable component identity", () => {
    const hotId = "test:create-component:Label";
    const Label = createComponent({
      props: defineProps<{ label: string }>(),
      state: ({ props }) => {
        const [count, setCount] = useState(0);
        return { count, label: props.label, setCount };
      },
      ui: ({ state }) => (
        <button
          type="button"
          onClick={() => state.setCount((count) => count + 1)}
        >
          {`Before ${state.label} ${state.count}`}
        </button>
      ),
    }).__effectReactHot(hotId, {
      state: "counter-state",
      ui: "before-ui",
    });

    render(<Label label="refresh" />);
    act(() => screen.getByRole("button").click());
    expect(screen.getByText("Before refresh 1")).toBeInTheDocument();

    let RefreshedLabel: typeof Label | undefined;
    act(() => {
      RefreshedLabel = createComponent({
        props: defineProps<{ label: string }>(),
        state: ({ props }) => {
          const [count, setCount] = useState(0);
          return { count, label: props.label, setCount };
        },
        ui: ({ state }) => (
          <button
            type="button"
            onClick={() => state.setCount((count) => count + 1)}
          >
            {`After ${state.label} ${state.count}`}
          </button>
        ),
      }).__effectReactHot(hotId, {
        state: "counter-state",
        ui: "after-ui",
      });
    });

    expect(RefreshedLabel).toBe(Label);
    expect(screen.getByText("After refresh 1")).toBeInTheDocument();
  });

  test("remounts only the evaluator whose hook-bearing callback changed", () => {
    const stateHotId = "test:create-component:StateSignature";
    const StateSignature = createComponent({
      state: () => {
        const [count, setCount] = useState(0);
        return { count, setCount };
      },
      ui: ({ state }) => (
        <button
          type="button"
          onClick={() => state.setCount((count) => count + 1)}
        >
          {state.count}
        </button>
      ),
    }).__effectReactHot(stateHotId, {
      state: "one-hook",
      ui: "counter-ui",
    });

    render(<StateSignature />);
    act(() => screen.getByRole("button").click());
    expect(screen.getByText("1")).toBeInTheDocument();

    act(() => {
      createComponent({
        state: () => {
          const [count, setCount] = useState(0);
          const [suffix] = useState("safe");
          return { count, setCount, suffix };
        },
        ui: ({ state }) => (
          <button type="button" onClick={() => state.setCount(1)}>
            {`${state.count} ${state.suffix}`}
          </button>
        ),
      }).__effectReactHot(stateHotId, {
        state: "two-hooks",
        ui: "changed-counter-ui",
      });
    });

    expect(screen.getByText("0 safe")).toBeInTheDocument();
  });

  test("resolves declared stores under their dependency keys", () => {
    const CounterStore = createStore<{
      count: number;
    }>();
    const Counter = createComponent({
      deps: [CounterStore],
      state: ({ deps }) => ({
        count: useStore(deps.store!, (snapshot) => snapshot.count),
      }),
      ui: ({ state }) => <span>{state.count}</span>,
    });

    render(
      <CounterStore implements={() => ({ count: 7 })}>
        <Counter />
      </CounterStore>,
    );

    expect(screen.getByText("7")).toBeInTheDocument();
  });

  test("fails clearly when a declared store has no provider", () => {
    const CounterStore = createStore<{
      count: number;
    }>();
    const Counter = createComponent({
      deps: [CounterStore],
      ui: () => null,
    });

    expect(() => render(<Counter />)).toThrow("Service not found");
  });
});
