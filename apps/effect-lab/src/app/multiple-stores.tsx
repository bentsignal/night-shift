import { createFileRoute } from "@tanstack/react-router";

import { toStandaloneComponent } from "@night-shift/effect-react";

import { MultipleStoresLab } from "../features/effect-lab/multiple-stores-lab";

export const Route = createFileRoute("/multiple-stores")({
  component: toStandaloneComponent(MultipleStoresLab),
});
