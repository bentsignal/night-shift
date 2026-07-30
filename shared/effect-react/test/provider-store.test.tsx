import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { act, render, screen } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, test } from "vitest";

import { createComponent, createStore } from "../src";

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
      state: Effect.gen(function* () {
        const useExample = yield* example.service;
        return function useCount() {
          const count = useExample((state) => state.count);
          countRenders += 1;
          return Effect.succeed({ count });
        };
      }),
      component: ({ state }) => <span>{state.count}</span>,
    });
    const Actions = createComponent({
      state: Effect.gen(function* () {
        const useExample = yield* example.service;
        return function useActions() {
          return Effect.succeed({
            setCount: useExample((state) => state.setCount),
            setText: useExample((state) => state.setText),
          });
        };
      }),
      component: ({ state }) => (
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
      state: Effect.gen(function* () {
        const useExample = yield* example.service;
        return ({ label }: { label: string }) =>
          Effect.succeed({
            label,
            value: useExample((state) => state.value),
          });
      }),
      component: ({ state }) => <span>{`${state.label}: ${state.value}`}</span>,
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
      state: Effect.gen(function* () {
        const useExample = yield* example.service;
        return () =>
          Effect.succeed({
            value: useExample((state) => state.value),
          });
      }),
      component: ({ state }) => <span>{state.value}</span>,
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
      state: Effect.gen(function* () {
        const useExample = yield* example.service;
        return () =>
          Effect.succeed({ count: useExample((state) => state.count) });
      }),
      component: ({ state }) => <span>{state.count}</span>,
    });

    expect(() => render(<Count />)).toThrow("Service not found");
  });

  test("renders the initial implementation snapshot on the server", () => {
    const example = createStore("ServerSnapshot")<{ count: number }>();
    const Count = createComponent({
      state: Effect.gen(function* () {
        const useExample = yield* example.service;
        return () =>
          Effect.succeed({ count: useExample((state) => state.count) });
      }),
      component: ({ state }) => <span>{state.count}</span>,
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
      state: Effect.gen(function* () {
        const useCounter = yield* example.service;
        return function useCounterState() {
          const count = useCounter((state) => state.count);
          const setCount = useCounter((state) => state.setCount);
          return Effect.succeed({
            count,
            increment: () => setCount((current) => current + 1),
          });
        };
      }),
      component: ({ state }) => (
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
