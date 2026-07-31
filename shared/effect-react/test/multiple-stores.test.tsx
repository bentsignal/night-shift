import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { BothProvidedPair } from "../example/multiple-stores";

describe("multiple store providers", () => {
  test("provides both store implementations to their consumers", () => {
    render(<BothProvidedPair />);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
  });
});
