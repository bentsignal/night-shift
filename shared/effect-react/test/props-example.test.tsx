import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { PropsExample } from "../example/props";

describe("props example", () => {
  test("derives UI state from component props and store dependencies", () => {
    render(<PropsExample />);

    expect(screen.getByText("Hello, Ada!")).toBeInTheDocument();
  });
});
