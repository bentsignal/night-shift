import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Greeting } from "../example/props";

describe("props example", () => {
  test("derives UI state from component props", () => {
    render(<Greeting name="Ada" punctuation="!" />);

    expect(screen.getByText("Hello, Ada!")).toBeInTheDocument();
  });
});
