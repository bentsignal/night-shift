import { act, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { CounterExample } from "../example/counter";

describe("CounterExample", () => {
  test("connects provider state to the created component", () => {
    render(<CounterExample />);

    expect(
      screen.getByRole("heading", { name: "Counter panel" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nested counter")).toBeInTheDocument();

    const counter = screen.getByRole("button", { name: "Count: 0" });
    act(() => {
      counter.click();
    });

    expect(
      screen.getByRole("button", { name: "Count: 1" }),
    ).toBeInTheDocument();
  });
});
