import { createFileRoute } from "@tanstack/react-router";

import { toStandaloneComponent } from "@night-shift/effect-react";

import { EffectLab } from "../features/effect-lab/effect-lab";

export const Route = createFileRoute("/")({
  component: toStandaloneComponent(EffectLab),
});
