import { useState } from "react";
import { renderToString } from "react-dom/server";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { makeStore, useStore } from "../src/store";

describe("store selectors", () => {
  test("rerenders only when the selected slice changes", () => {
    const store = makeStore({ count: 0, text: "initial" });
    let renders = 0;

    function Count() {
      renders += 1;
      const count = useStore(store, (state) => state.count);
      return <span>{count}</span>;
    }

    render(<Count />);
    expect(renders).toBe(1);

    act(() => {
      store.update((state) => ({ ...state, text: "changed" }));
    });
    expect(renders).toBe(1);

    act(() => {
      store.update((state) => ({ ...state, count: state.count + 1 }));
    });
    expect(renders).toBe(2);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  test("recomputes when a selector closure changes", () => {
    const store = makeStore({ count: 3 });

    function Count() {
      const [multiplier, setMultiplier] = useState(1);
      const count = useStore(store, (state) => state.count * multiplier);
      return (
        <button type="button" onClick={() => setMultiplier(2)}>
          {count}
        </button>
      );
    }

    render(<Count />);
    expect(screen.getByRole("button")).toHaveTextContent("3");

    act(() => {
      screen.getByRole("button").click();
    });
    expect(screen.getByRole("button")).toHaveTextContent("6");
  });

  test("supports custom selection equality", () => {
    const store = makeStore({ count: 0 });
    let renders = 0;

    function Parity() {
      renders += 1;
      const selection = useStore(
        store,
        (state) => ({ even: state.count % 2 === 0 }),
        {
          isEqual: (previous, next) => previous.even === next.even,
        },
      );
      return <span>{String(selection.even)}</span>;
    }

    render(<Parity />);
    act(() => {
      store.set({ count: 2 });
    });
    expect(renders).toBe(1);

    act(() => {
      store.set({ count: 3 });
    });
    expect(renders).toBe(2);
  });

  test("retains equal selection identity across parent renders", () => {
    const store = makeStore({ count: 2 });
    const selections = new Array<{ even: boolean }>();

    function Parity({ label }: { label: string }) {
      const selection = useStore(
        store,
        (state) => ({ even: state.count % 2 === 0 }),
        {
          isEqual: (previous, next) => previous.even === next.even,
        },
      );
      selections.push(selection);
      return <span>{label}</span>;
    }

    const view = render(<Parity label="first" />);
    view.rerender(<Parity label="second" />);

    expect(selections).toHaveLength(2);
    expect(selections[1]).toBe(selections[0]);
  });

  test("does not notify when the store identity is unchanged", () => {
    const state = { count: 0 };
    const store = makeStore(state);
    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });

    store.set(state);
    expect(notifications).toBe(0);

    unsubscribe();
    store.set({ count: 1 });
    expect(notifications).toBe(0);
  });

  test("supports function-valued state", () => {
    const store = makeStore<() => number>(() => 1);
    store.set(() => 2);
    expect(store.getSnapshot()()).toBe(2);
  });

  test("uses the explicit server snapshot during server rendering", () => {
    const store = makeStore(
      { count: 1 },
      { getServerSnapshot: () => ({ count: 99 }) },
    );

    function Count() {
      const count = useStore(store, (state) => state.count);
      return <span>{count}</span>;
    }

    expect(renderToString(<Count />)).toContain(">99<");
  });
});
