import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { createComponent, createStore, useStore } from "../src";

describe("createComponent", () => {
  test("renders stateless UI with props and no manufactured state", () => {
    const ui = vi.fn(({ props }: { props: { label: string } }) => (
      <span>{props.label}</span>
    ));
    const Label = createComponent<{ label: string }>({ ui });

    render(<Label label="Ready" />);

    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(ui).toHaveBeenCalledWith({ props: { label: "Ready" } });
  });

  test("passes plain state from state to UI", () => {
    const Counter = createComponent({
      state: ({ props }: { props: { initial: number } }) => ({
        count: props.initial,
      }),
      ui: ({ props, state }) => (
        <span>{`${props.initial}: ${state.count}`}</span>
      ),
    });

    render(<Counter initial={42} />);

    expect(screen.getByText("42: 42")).toBeInTheDocument();
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
