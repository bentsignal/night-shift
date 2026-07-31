import { useState } from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { CounterState } from "../example/counter";
import { Counter, CounterExample } from "../example/counter";

describe("CounterExample", () => {
  test("connects provider state to the created component", () => {
    function useCounterImplementation() {
      const [count, setCount] = useState(0);
      return { count, setCount } satisfies CounterState;
    }

    render(
      <Counter implements={useCounterImplementation}>
        <CounterExample />
      </Counter>,
    );

    expect(
      screen.getByRole("heading", { name: "Counter panel" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nested counter")).toBeInTheDocument();

    const counterButton = screen.getByRole("button", { name: "Count: 0" });
    act(() => {
      counterButton.click();
    });

    expect(
      screen.getByRole("button", { name: "Count: 1" }),
    ).toBeInTheDocument();
  });
});
