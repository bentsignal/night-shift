import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

import { createStore } from "@night-shift/effect-react";

import type {
  ControlPlaneClient,
  ControlPlaneSnapshot,
  RunCommand,
  SubmitWorkInput,
} from "./types";

export function useControlPlaneState({
  client,
}: {
  client: ControlPlaneClient;
}) {
  const snapshot = useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
    client.getSnapshot,
  );

  return {
    ...snapshot,
    commandRun: client.commandRun,
    submitWork: client.submitWork,
  };
}

export interface ControlPlaneState extends ControlPlaneSnapshot {
  submitWork: (input: SubmitWorkInput) => Promise<string>;
  commandRun: (runId: string, command: RunCommand) => Promise<void>;
}

export const controlPlane = createStore("ControlPlane")<ControlPlaneState>();

export function ControlPlaneProvider({
  children,
  client,
}: {
  children?: ReactNode;
  client: ControlPlaneClient;
}) {
  const implementation = useControlPlaneState({ client });

  return (
    <controlPlane.Store implements={() => implementation}>
      {children}
    </controlPlane.Store>
  );
}
