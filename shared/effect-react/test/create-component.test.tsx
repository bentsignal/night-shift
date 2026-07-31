import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { createComponent, createStore, useStore } from "../src";

describe("createComponent", () => {
  test("routes props through state before rendering UI", () => {
    const ui = vi.fn(({ state }: { state: { label: string } }) => (
      <span>{state.label}</span>
    ));
    const Label = createComponent({
      state: ({ props }: { props: { label: string } }) => ({
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
      state: ({ props }: { props: { initial: number } }) => ({
        count: props.initial,
        label: `Initial ${props.initial}`,
      }),
      ui: ({ state }) => <span>{`${state.label}: ${state.count}`}</span>,
    });

    render(<Counter initial={42} />);

    expect(screen.getByText("Initial 42: 42")).toBeInTheDocument();
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
