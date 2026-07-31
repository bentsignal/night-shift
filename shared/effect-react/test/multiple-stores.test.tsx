import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { FullyProvidedDashboard } from "../example/multiple-stores";

describe("multiple store providers", () => {
  test("updates three independent stores across nested provider boundaries", () => {
    render(<FullyProvidedDashboard />);

    expect(screen.getByLabelText("Transformed operator")).toHaveTextContent(
      "ADA",
    );
    expect(screen.getByLabelText("Current accent")).toHaveTextContent("violet");
    expect(screen.getByText("Night Shift")).toBeInTheDocument();
    expect(screen.getByLabelText("Build count")).toHaveTextContent("03");

    fireEvent.change(screen.getByLabelText("Operator"), {
      target: { value: "Grace Hopper" },
    });
    expect(screen.getByLabelText("Transformed operator")).toHaveTextContent(
      "GRACE HOPPER",
    );

    fireEvent.click(screen.getByRole("button", { name: "Change accent" }));
    expect(screen.getByLabelText("Current accent")).toHaveTextContent("amber");

    fireEvent.click(
      screen.getByRole("button", { name: "Increase build count" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Increase build count" }),
    );
    expect(screen.getByLabelText("Build count")).toHaveTextContent("05");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Build count")).toHaveTextContent("00");
  });
});
