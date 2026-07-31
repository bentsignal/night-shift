import { render, screen } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, test, vi } from "vitest";

import {
  AsyncComponentStateError,
  createComponent,
  makeStore,
  useStoreSelector,
} from "../src";

describe("createComponent", () => {
  test("passes dependencies, props, and state through each phase", () => {
    const deps = { suffix: "!" };
    const state = vi.fn(
      ({
        deps: resolved,
        props,
      }: {
        deps: typeof deps;
        props: { label: string };
      }) =>
        Effect.succeed({
          count: 42,
          label: `${props.label}${resolved.suffix}`,
        }),
    );
    const ui = vi.fn(
      ({
        props,
        state: componentState,
      }: {
        props: { label: string };
        state: { count: number; label: string };
      }) => <span>{`${props.label}: ${componentState.count}`}</span>,
    );
    const Counter = createComponent({
      deps: Effect.succeed(deps),
      state,
      ui,
    });

    render(<Counter label="Count" />);

    expect(screen.getByText("Count: 42")).toBeInTheDocument();
    expect(state).toHaveBeenCalledWith({
      deps,
      props: { label: "Count" },
    });
    expect(ui).toHaveBeenCalledWith({
      props: { label: "Count" },
      state: { count: 42, label: "Count!" },
    });
  });

  test("keeps store selection inside state", () => {
    const store = makeStore({ count: 7 });
    const Counter = createComponent({
      state: () =>
        Effect.succeed({
          count: useStoreSelector(store, (snapshot) => snapshot.count),
        }),
      ui: ({ state }) => <span>{state.count}</span>,
    });

    render(<Counter />);

    expect(screen.getByText("7")).toBeInTheDocument();
  });

  test("renders typed state-construction failures explicitly", () => {
    const Failed = createComponent({
      deps: Effect.fail("missing-store" as const),
      state: () => Effect.succeed({ ready: false }),
      ui: ({ state }) => <span>{String(state.ready)}</span>,
      onFailure: (error) => <span>{error}</span>,
    });

    render(<Failed />);

    expect(screen.getByText("missing-store")).toBeInTheDocument();
  });

  test("allows an explicit defect renderer", () => {
    const Defect = createComponent({
      deps: Effect.die("broken-state"),
      state: () => Effect.succeed({ ready: false }),
      ui: ({ state }) => <span>{String(state.ready)}</span>,
      onDefect: (defect) => <span>{String(defect)}</span>,
    });

    render(<Defect />);

    expect(screen.getByText("broken-state")).toBeInTheDocument();
  });

  test("rejects asynchronous state construction", () => {
    const deps = Effect.promise(async () => ({ ready: true }));

    const Async = createComponent({
      deps,
      state: () => Effect.succeed({}),
      ui: () => null,
    });

    expect(() => render(<Async />)).toThrow(AsyncComponentStateError);
  });

  test("preserves typed failures through state evaluation", () => {
    const Failed = createComponent({
      state: () => Effect.fail("state-failure" as const),
      ui: () => <span>unreachable</span>,
      onFailure: (error) => <span>{error}</span>,
    });

    render(<Failed />);

    expect(screen.getByText("state-failure")).toBeInTheDocument();
  });
});
