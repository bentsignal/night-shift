import { createFileRoute } from "@tanstack/react-router";

import { toReactComponent } from "@night-shift/effect-react";

import { PropsLab } from "../features/effect-lab/props-lab";

export const Route = createFileRoute("/props")({
  component: toReactComponent(PropsLab),
});
