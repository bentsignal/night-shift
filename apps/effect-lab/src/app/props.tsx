import { createFileRoute } from "@tanstack/react-router";

import { PropsLabRoute } from "../features/effect-lab/props-lab-route";

export const Route = createFileRoute("/props")({
  component: PropsLabRoute,
});
