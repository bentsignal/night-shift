import { act, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { toReactComponent } from "@night-shift/effect-react";

import { EffectLab } from "./effect-lab";

const EffectLabReact = toReactComponent(EffectLab);

describe("Effect lab", () => {
  test("closes into a normal React component with every store resolved", () => {
    render(<EffectLabReact />);

    expect(screen.getByText(/^\+[0-9]{2}$/u)).toBeInTheDocument();
    expect(screen.getByText("Unresolved requirements")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  test("updates shared Effect store state through ordinary JSX children", () => {
    render(<EffectLabReact />);

    act(() => {
      screen.getByRole("button", { name: "reset" }).click();
    });
    expect(screen.getByText("+00")).toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "Increase count" }).click();
      screen.getByRole("button", { name: "Increase count" }).click();
    });
    expect(screen.getByText("+02")).toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "Decrease count" }).click();
    });
    expect(screen.getByText("+01")).toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "reset" }).click();
    });
    expect(screen.getByText("+00")).toBeInTheDocument();
  });
});
