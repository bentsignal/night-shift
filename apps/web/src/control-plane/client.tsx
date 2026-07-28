import { useSyncExternalStore } from "react";

import { createStore } from "@code/effect-react";

import type {
  ControlPlaneClient,
  ControlPlaneSnapshot,
  RunCommand,
  SubmitWorkInput,
} from "./types";

function useControlPlaneState({ client }: { client: ControlPlaneClient }) {
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

const controlPlane = createStore(useControlPlaneState);

export const ControlPlaneProvider = controlPlane.Store;
export const useControlPlane = controlPlane.useStore;
