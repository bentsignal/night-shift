import type { ComponentType } from "react";
import { render, screen } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, test } from "vitest";

import {
  AsyncComponentFactoryError,
  Component,
  Hook,
  makeStore,
  useStoreSelector,
} from "../src";

describe("Effect-built React factories", () => {
  test("builds a component from Effect and renders it", () => {
    const store = makeStore({ count: 42 });
    const factory = Component.make(
      Effect.succeed(function Counter() {
        const count = useStoreSelector(store, (state) => state.count);
        return <span>{count}</span>;
      }),
    );

    const Counter = Component.mount(factory, {
      onFailure: () => null,
    });

    render(<Counter />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  test("renders typed factory failures explicitly", () => {
    const factory = Component.make(
      Effect.fail("missing-store" as const).pipe(
        Effect.as((() => null) as ComponentType<Record<string, never>>),
      ),
    );

    const Failed = Component.mount(factory, {
      onFailure: (error) => <span>{error}</span>,
    });

    render(<Failed />);
    expect(screen.getByText("missing-store")).toBeInTheDocument();
  });

  test("allows an explicit defect renderer", () => {
    const factory = Component.make(
      Effect.die("broken-renderer").pipe(
        Effect.as((() => null) as ComponentType<Record<string, never>>),
      ),
    );

    const Defect = Component.mount(factory, {
      onDefect: (defect) => <span>{String(defect)}</span>,
      onFailure: () => null,
    });

    render(<Defect />);
    expect(screen.getByText("broken-renderer")).toBeInTheDocument();
  });

  test("rejects asynchronous component factories", () => {
    const factory = Component.make(
      Effect.promise(
        async () => (() => null) as ComponentType<Record<string, never>>,
      ),
    );

    expect(() =>
      Component.mount(factory, {
        onFailure: () => null,
      }),
    ).toThrow(AsyncComponentFactoryError);
  });

  test("builds hooks through Effect without executing hooks in Effect", () => {
    const store = makeStore({ count: 7 });
    const hookFactory = Hook.make(
      Effect.succeed(() => useStoreSelector(store, (state) => state.count)),
    );
    const componentFactory = Component.make(
      Effect.gen(function* () {
        const useCount = yield* hookFactory;
        return function Count() {
          return <span>{useCount()}</span>;
        };
      }),
    );
    const Count = Component.mount(componentFactory, {
      onFailure: () => null,
    });

    render(<Count />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
