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
  test("passes props and state to the component", () => {
    const state = vi.fn(() => Effect.succeed({ count: 42 }));
    const component = vi.fn(
      ({
        props,
        state: componentState,
      }: {
        props: { label: string };
        state: { count: number };
      }) => <span>{`${props.label}: ${componentState.count}`}</span>,
    );
    const Counter = createComponent({
      state: Effect.succeed(state),
      component,
    });

    render(<Counter label="Count" />);

    expect(screen.getByText("Count: 42")).toBeInTheDocument();
    expect(state).toHaveBeenCalledWith({ label: "Count" });
    expect(component).toHaveBeenCalledWith({
      props: { label: "Count" },
      state: { count: 42 },
    });
  });

  test("keeps store selection inside state", () => {
    const store = makeStore({ count: 7 });
    const Counter = createComponent({
      state: Effect.succeed(() =>
        Effect.succeed({
          count: useStoreSelector(store, (snapshot) => snapshot.count),
        }),
      ),
      component: ({ state }) => <span>{state.count}</span>,
    });

    render(<Counter />);

    expect(screen.getByText("7")).toBeInTheDocument();
  });

  test("renders typed state-construction failures explicitly", () => {
    const Failed = createComponent({
      state: Effect.fail("missing-store" as const).pipe(
        Effect.as(() => Effect.succeed({ ready: false })),
      ),
      component: ({ state }) => <span>{String(state.ready)}</span>,
      onFailure: (error) => <span>{error}</span>,
    });

    render(<Failed />);

    expect(screen.getByText("missing-store")).toBeInTheDocument();
  });

  test("allows an explicit defect renderer", () => {
    const Defect = createComponent({
      state: Effect.die("broken-state").pipe(
        Effect.as(() => Effect.succeed({ ready: false })),
      ),
      component: ({ state }) => <span>{String(state.ready)}</span>,
      onDefect: (defect) => <span>{String(defect)}</span>,
    });

    render(<Defect />);

    expect(screen.getByText("broken-state")).toBeInTheDocument();
  });

  test("rejects asynchronous state construction", () => {
    const state = Effect.promise(
      async () => () => Effect.succeed({ ready: true }),
    );

    const Async = createComponent({
      state,
      component: () => null,
    });

    expect(() => render(<Async />)).toThrow(AsyncComponentStateError);
  });

  test("preserves typed failures through state evaluation", () => {
    const Failed = createComponent({
      state: Effect.succeed(() => Effect.fail("state-failure" as const)),
      component: () => <span>unreachable</span>,
      onFailure: (error) => <span>{error}</span>,
    });

    render(<Failed />);

    expect(screen.getByText("state-failure")).toBeInTheDocument();
  });
});
