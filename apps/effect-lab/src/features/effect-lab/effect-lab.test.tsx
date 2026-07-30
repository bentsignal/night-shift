import { act, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { EffectLabRoute } from "./effect-lab-route";

describe("Effect lab", () => {
  test("crosses a normal React route boundary and resolves the midpoint store", () => {
    const view = render(<EffectLabRoute />);

    expect(view.container.firstElementChild).toHaveAttribute(
      "data-boundary",
      "react-route",
    );
    expect(screen.getByText("+05")).toBeInTheDocument();
    expect(screen.getByText("Unresolved requirements")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  test("updates shared Effect store state through ordinary JSX children", () => {
    render(<EffectLabRoute />);

    act(() => {
      screen.getByRole("button", { name: "Increase count" }).click();
      screen.getByRole("button", { name: "Increase count" }).click();
    });
    expect(screen.getByText("+07")).toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "Decrease count" }).click();
    });
    expect(screen.getByText("+06")).toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "reset" }).click();
    });
    expect(screen.getByText("+00")).toBeInTheDocument();
  });
});
