import { createFileRoute } from "@tanstack/react-router";

import { toReactComponent } from "@night-shift/effect-react";

import { EffectLab } from "../features/effect-lab/effect-lab";

export const Route = createFileRoute("/")({
  component: toReactComponent(EffectLab),
});
