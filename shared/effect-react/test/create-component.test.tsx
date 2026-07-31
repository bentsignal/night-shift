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

  test("resolves declared stores as an ordered tuple", () => {
    const counter = createStore("ComponentTestCounter")<{ count: number }>();
    const Counter = createComponent({
      deps: [counter.store],
      state: ({ deps: [store] }) => ({
        count: useStore(store, (snapshot) => snapshot.count),
      }),
      ui: ({ state }) => <span>{state.count}</span>,
    });

    render(
      <counter.Store implements={() => ({ count: 7 })}>
        <Counter />
      </counter.Store>,
    );

    expect(screen.getByText("7")).toBeInTheDocument();
  });

  test("fails clearly when a declared store has no provider", () => {
    const counter = createStore("MissingComponentTestCounter")<{
      count: number;
    }>();
    const Counter = createComponent({
      deps: [counter.store],
      ui: () => null,
    });

    expect(() => render(<Counter />)).toThrow("Service not found");
  });
});
