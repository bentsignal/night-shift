import { createFileRoute } from "@tanstack/react-router";

import { MultipleStoresLabRoute } from "../features/effect-lab/multiple-stores-lab-route";

export const Route = createFileRoute("/multiple-stores")({
  component: MultipleStoresLabRoute,
});
