import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { ResolvedDependencies } from "../src";
import { createComponent, createStore, useStore } from "../src";

describe("provider stores", () => {
  test("gives same-shaped stores distinct identities", () => {
    const first = createStore("FirstIdentity")<{ count: number }>();
    const second = createStore("SecondIdentity")<{ count: number }>();

    expect(first.store.key).not.toBe(second.store.key);
  });

  test("rerenders consumers only when their selected state changes", () => {
    const example = createStore("SelectiveRerenders")<{
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
      deps: [example.store],
      state: ({ deps: [store] }) => {
        const count = useStore(store, (state) => state.count);
        countRenders += 1;
        return { count };
      },
      ui: ({ state }) => <span>{state.count}</span>,
    });
    const Actions = createComponent({
      deps: [example.store],
      state: ({ deps: [store] }) => ({
        setCount: useStore(store, (state) => state.setCount),
        setText: useStore(store, (state) => state.setText),
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
      <example.Store implements={useImplementation}>
        <Count />
        <Actions />
      </example.Store>,
    );

    act(() => screen.getByRole("button", { name: "Change text" }).click());
    expect(countRenders).toBe(1);

    act(() => screen.getByRole("button", { name: "Change count" }).click());
    expect(countRenders).toBe(2);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  test("isolates nested provider implementations", () => {
    const example = createStore("NestedProviders")<{ value: string }>();
    const Value = createComponent({
      deps: [example.store],
      state: ({
        deps: [store],
        props,
      }: {
        deps: ResolvedDependencies<[typeof example.store]>;
        props: { label: string };
      }) => ({
        label: props.label,
        value: useStore(store, (state) => state.value),
      }),
      ui: ({ state }) => <span>{`${state.label}: ${state.value}`}</span>,
    });

    render(
      <example.Store implements={() => ({ value: "outer" })}>
        <Value label="outer" />
        <example.Store implements={() => ({ value: "inner" })}>
          <Value label="inner" />
        </example.Store>
      </example.Store>,
    );

    expect(screen.getByText("outer: outer")).toBeInTheDocument();
    expect(screen.getByText("inner: inner")).toBeInTheDocument();
  });

  test("renders the initial implementation snapshot on the server", () => {
    const example = createStore("ServerSnapshot")<{ count: number }>();
    const Count = createComponent({
      deps: [example.store],
      state: ({ deps: [store] }) => ({
        count: useStore(store, (state) => state.count),
      }),
      ui: ({ state }) => <span>{state.count}</span>,
    });

    expect(
      renderToString(
        <example.Store implements={() => ({ count: 7 })}>
          <Count />
        </example.Store>,
      ),
    ).toContain(">7<");
  });
});
