import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { createComponent, createStore, defineProps, useStore } from "../src";

describe("provider stores", () => {
  test("gives same-shaped stores distinct identities", () => {
    const First = createStore<{ count: number }>();
    const Second = createStore<{ count: number }>();

    expect(First.key).not.toBe(Second.key);
  });

  test("rerenders consumers only when their selected state changes", () => {
    const Example = createStore<{
      count: number;
      setCount: Dispatch<SetStateAction<number>>;
      setText: Dispatch<SetStateAction<string>>;
      text: string;
    }>();
    let countRenders = 0;

    function useImplementation() {
      const [count, setCount] = useState(0);
      const [text, setText] = useState("initial");
      return { count, setCount, setText, text };
    }

    const Count = createComponent({
      deps: [Example],
      state: ({ deps }) => {
        const count = useStore(deps.store!, (state) => state.count);
        countRenders += 1;
        return { count };
      },
      ui: ({ state }) => <span>{state.count}</span>,
    });
    const Actions = createComponent({
      deps: [Example],
      state: ({ deps }) => ({
        setCount: useStore(deps.store!, (state) => state.setCount),
        setText: useStore(deps.store!, (state) => state.setText),
      }),
      ui: ({ state }) => (
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
      <Example implements={useImplementation}>
        <Count />
        <Actions />
      </Example>,
    );

    act(() => screen.getByRole("button", { name: "Change text" }).click());
    expect(countRenders).toBe(1);

    act(() => screen.getByRole("button", { name: "Change count" }).click());
    expect(countRenders).toBe(2);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  test("isolates nested provider implementations", () => {
    const Example = createStore<{ value: string }>();
    const Value = createComponent({
      props: defineProps<{ label: string }>(),
      deps: [Example],
      state: ({ deps, props }) => ({
        label: props.label,
        value: useStore(deps.store!, (state) => state.value),
      }),
      ui: ({ state }) => <span>{`${state.label}: ${state.value}`}</span>,
    });

    render(
      <Example implements={() => ({ value: "outer" })}>
        <Value label="outer" />
        <Example implements={() => ({ value: "inner" })}>
          <Value label="inner" />
        </Example>
      </Example>,
    );

    expect(screen.getByText("outer: outer")).toBeInTheDocument();
    expect(screen.getByText("inner: inner")).toBeInTheDocument();
  });

  test("renders the initial implementation snapshot on the server", () => {
    const Example = createStore<{ count: number }>();
    const Count = createComponent({
      deps: [Example],
      state: ({ deps }) => ({
        count: useStore(deps.store!, (state) => state.count),
      }),
      ui: ({ state }) => <span>{state.count}</span>,
    });

    expect(
      renderToString(
        <Example implements={() => ({ count: 7 })}>
          <Count />
        </Example>,
      ),
    ).toContain(">7<");
  });
});
