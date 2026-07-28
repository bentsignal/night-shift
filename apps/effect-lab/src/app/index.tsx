import { createFileRoute } from "@tanstack/react-router";

import { EffectLabRoute } from "../features/effect-lab/effect-lab-route";

export const Route = createFileRoute("/")({
  component: EffectLabRoute,
});
