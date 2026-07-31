import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { FullyProvidedDashboard } from "../example/multiple-stores";

describe("multiple store providers", () => {
  test("provides three store implementations across nested boundaries", () => {
    render(<FullyProvidedDashboard />);

    expect(screen.getByText("Ada · violet")).toBeInTheDocument();
    expect(screen.getByText("Night Shift")).toBeInTheDocument();
  });
});
