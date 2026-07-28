import { useState } from "react";
import { renderToString } from "react-dom/server";
import { act, render, screen } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, test } from "vitest";

import { createComponent, createStore } from "../src";

describe("provider stores", () => {
  test("rejects duplicate service identities", () => {
    createStore({
      name: "UniqueStoreIdentity",
      state: () => ({ count: 0 }),
    });

    expect(() =>
      createStore({
        name: "UniqueStoreIdentity",
        state: () => ({ label: "wrong service" }),
      }),
    ).toThrow(
      'Effect React store names must be unique. "UniqueStoreIdentity" is already registered.',
    );
  });

  test("rerenders consumers only when their selected state changes", () => {
    const example = createStore({
      name: "SelectiveRerenders",
      state: function useSelectiveRerendersStore() {
        const [count, setCount] = useState(0);
        const [text, setText] = useState("initial");
        return { count, setCount, setText, text };
      },
    });
    let countRenders = 0;

    function Count() {
      countRenders += 1;
      const count = example.useStore((state) => state.count);
      return <span>{count}</span>;
    }

    function Actions() {
      const setCount = example.useStore((state) => state.setCount);
      const setText = example.useStore((state) => state.setText);
      return (
        <>
          <button type="button" onClick={() => setText("changed")}>
            Change text
          </button>
          <button type="button" onClick={() => setCount(1)}>
            Change count
          </button>
        </>
      );
    }

    render(
      <example.Store>
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
    const example = createStore({
      name: "NestedProviders",
      state: ({ value }: { value: string }) => ({ value }),
    });

    function Value({ label }: { label: string }) {
      const value = example.useStore((state) => state.value);
      return <span>{`${label}: ${value}`}</span>;
    }

    render(
      <example.Store value="outer">
        <Value label="outer" />
        <example.Store value="inner">
          <Value label="inner" />
        </example.Store>
      </example.Store>,
    );

    expect(screen.getByText("outer: outer")).toBeInTheDocument();
    expect(screen.getByText("inner: inner")).toBeInTheDocument();
  });

  test("publishes provider prop changes", () => {
    const example = createStore({
      name: "ProviderProps",
      state: ({ value }: { value: string }) => ({ value }),
    });

    function Value() {
      const value = example.useStore((state) => state.value);
      return <span>{value}</span>;
    }

    const view = render(
      <example.Store value="first">
        <Value />
      </example.Store>,
    );
    view.rerender(
      <example.Store value="second">
        <Value />
      </example.Store>,
    );

    expect(screen.getByText("second")).toBeInTheDocument();
  });

  test("fails clearly outside its provider", () => {
    const example = createStore({
      name: "MissingProvider",
      state: () => ({ count: 0 }),
    });

    function Count() {
      return <span>{example.useStore((state) => state.count)}</span>;
    }

    expect(() => render(<Count />)).toThrow(
      "useStore must be used within its Store",
    );
  });

  test("renders the initial provider snapshot on the server", () => {
    const example = createStore({
      name: "ServerSnapshot",
      state: ({ count }: { count: number }) => ({ count }),
    });

    function Count() {
      return <span>{example.useStore((state) => state.count)}</span>;
    }

    expect(
      renderToString(
        <example.Store count={7}>
          <Count />
        </example.Store>,
      ),
    ).toContain(">7<");
  });

  test("provides its generated Effect service to descendant components", () => {
    const example = createStore({
      name: "EffectCounter",
      state: function useEffectCounterStore() {
        const [count, setCount] = useState(0);
        return { count, setCount };
      },
    });
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

    render(
      <example.Store>
        <Counter />
      </example.Store>,
    );

    act(() => {
      screen.getByRole("button", { name: "0" }).click();
    });
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
  });
});
