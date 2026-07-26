import { createFileRoute } from "@tanstack/react-router";

import { ControlPlaneShell } from "../features/control-plane/control-plane-shell";

export const Route = createFileRoute("/_app")({
  component: ControlPlaneShell,
});
