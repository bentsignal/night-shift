import { createFileRoute } from "@tanstack/react-router";

import { EffectLab } from "../features/effect-lab/effect-lab";

export const Route = createFileRoute("/")({
  component: EffectLabRoute,
});

/**
 * Deliberately ordinary React. Effect requirements begin and end beneath this
 * route boundary.
 */
function EffectLabRoute() {
  return (
    <div data-boundary="react-route">
      <EffectLab />
    </div>
  );
}
