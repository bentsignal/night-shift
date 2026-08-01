import { createFileRoute } from "@tanstack/react-router";

import { toReactComponent } from "@night-shift/effect-react";

import { MultipleStoresLab } from "../features/effect-lab/multiple-stores-lab";

export const Route = createFileRoute("/multiple-stores")({
  component: toReactComponent(MultipleStoresLab),
});
