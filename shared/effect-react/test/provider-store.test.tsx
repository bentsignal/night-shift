import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { act, render, screen } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, test } from "vitest";

import { createComponent, createStore, useStoreSelector } from "../src";

describe("provider stores", () => {
  test("gives same-shaped stores distinct service identities", () => {
    const first = createStore("FirstIdentity")<{ count: number }>();
    const second = createStore("SecondIdentity")<{ count: number }>();

    expect(first.service.key).not.toBe(second.service.key);
  });

  test("rerenders consumers only when their selected state changes", () => {
    const example = createStore("SelectiveRerenders")<{
      count: number;
      setCount: Dispatch<SetStateAction<number>>;
      setText: Dispatch<SetStateAction<string>>;
      text: string;
    }>();
    let countRenders = 0;

    function useExampleImplementation() {
      const [count, setCount] = useState(0);
      const [text, setText] = useState("initial");
      return { count, setCount, setText, text };
    }

    const Count = createComponent({
      deps: Effect.gen(function* () {
        const store = yield* example.service;
        return { store };
      }),
      state: ({ deps }) => {
        const count = useStoreSelector(deps.store, (state) => state.count);
        countRenders += 1;
        return Effect.succeed({ count });
      },
      UI: ({ state }) => <span>{state.count}</span>,
    });
    const Actions = createComponent({
      deps: Effect.gen(function* () {
        const store = yield* example.service;
        return { store };
      }),
      state: ({ deps }) =>
        Effect.succeed({
          setCount: useStoreSelector(deps.store, (state) => state.setCount),
          setText: useStoreSelector(deps.store, (state) => state.setText),
        }),
      UI: ({ state }) => (
        <>
          <button type="button" onClick={() => state.setText("changed")}>
            Change text
          </button>
          <button type="button" onClick={() => state.setCount(1)}>
            Change count
          </button>
        </>
      ),
    });

    render(
      <example.Store implements={useExampleImplementation}>
        <Count />
        <Actions />
      </example.Store>,
    );

    act(() => {
      screen.getByRole("button", { name: "Change text" }).click();
    });
    expect(countRenders).toBe(1);

    act(() => {
      screen.getByRole("button", { name: "Change count" }).click();
    });
    expect(countRenders).toBe(2);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  test("isolates nested provider state", () => {
    const example = createStore("NestedProviders")<{ value: string }>();
    const Value = createComponent({
      deps: Effect.gen(function* () {
        const store = yield* example.service;
        return { store };
      }),
      state: ({
        deps,
        props,
      }: {
        deps: { store: Effect.Effect.Success<typeof example.service> };
        props: { label: string };
      }) =>
        Effect.succeed({
          label: props.label,
          value: useStoreSelector(deps.store, (state) => state.value),
        }),
      UI: ({ state }) => <span>{`${state.label}: ${state.value}`}</span>,
    });
    const useOuter = () => ({ value: "outer" });
    const useInner = () => ({ value: "inner" });

    render(
      <example.Store implements={useOuter}>
        <Value label="outer" />
        <example.Store implements={useInner}>
          <Value label="inner" />
        </example.Store>
      </example.Store>,
    );

    expect(screen.getByText("outer: outer")).toBeInTheDocument();
    expect(screen.getByText("inner: inner")).toBeInTheDocument();
  });

  test("publishes implementation changes", () => {
    const example = createStore("ProviderProps")<{ value: string }>();
    const Value = createComponent({
      deps: Effect.gen(function* () {
        const store = yield* example.service;
        return { store };
      }),
      state: ({ deps }) =>
        Effect.succeed({
          value: useStoreSelector(deps.store, (state) => state.value),
        }),
      UI: ({ state }) => <span>{state.value}</span>,
    });
    const useFirst = () => ({ value: "first" });
    const useSecond = () => ({ value: "second" });

    const view = render(
      <example.Store implements={useFirst}>
        <Value />
      </example.Store>,
    );
    view.rerender(
      <example.Store implements={useSecond}>
        <Value />
      </example.Store>,
    );

    expect(screen.getByText("second")).toBeInTheDocument();
  });

  test("fails clearly outside its provider", () => {
    const example = createStore("MissingProvider")<{ count: number }>();
    const Count = createComponent({
      deps: Effect.gen(function* () {
        const store = yield* example.service;
        return { store };
      }),
      state: ({ deps }) =>
        Effect.succeed({
          count: useStoreSelector(deps.store, (state) => state.count),
        }),
      UI: ({ state }) => <span>{state.count}</span>,
    });

    expect(() => render(<Count />)).toThrow("Service not found");
  });

  test("renders the initial implementation snapshot on the server", () => {
    const example = createStore("ServerSnapshot")<{ count: number }>();
    const Count = createComponent({
      deps: Effect.gen(function* () {
        const store = yield* example.service;
        return { store };
      }),
      state: ({ deps }) =>
        Effect.succeed({
          count: useStoreSelector(deps.store, (state) => state.count),
        }),
      UI: ({ state }) => <span>{state.count}</span>,
    });
    const useImplementation = () => ({ count: 7 });

    expect(
      renderToString(
        <example.Store implements={useImplementation}>
          <Count />
        </example.Store>,
      ),
    ).toContain(">7<");
  });

  test("provides its generated Effect service to descendant components", () => {
    const example = createStore("EffectCounter")<{
      count: number;
      setCount: Dispatch<SetStateAction<number>>;
    }>();
    const Counter = createComponent({
      deps: Effect.gen(function* () {
        const store = yield* example.service;
        return { store };
      }),
      state: ({ deps }) => {
        const count = useStoreSelector(deps.store, (state) => state.count);
        const setCount = useStoreSelector(
          deps.store,
          (state) => state.setCount,
        );
        return Effect.succeed({
          count,
          increment: () => setCount((current) => current + 1),
        });
      },
      UI: ({ state }) => (
        <button type="button" onClick={state.increment}>
          {state.count}
        </button>
      ),
    });

    function useEffectCounterImplementation() {
      const [count, setCount] = useState(0);
      return { count, setCount };
    }

    render(
      <example.Store implements={useEffectCounterImplementation}>
        <Counter />
      </example.Store>,
    );

    act(() => {
      screen.getByRole("button", { name: "0" }).click();
    });
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
  });
});
