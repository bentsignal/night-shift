import { createFileRoute } from "@tanstack/react-router";

import { toStandaloneComponent } from "@night-shift/effect-react";

import { PropsLab } from "../features/effect-lab/props-lab";

export const Route = createFileRoute("/props")({
  component: toStandaloneComponent(PropsLab),
});
