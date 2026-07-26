import type { ReactNode } from "react";
import { createContext, useContext, useSyncExternalStore } from "react";

import type {
  ControlPlaneClient,
  ControlPlaneSnapshot,
  RunCommand,
  SubmitWorkInput,
} from "./types";

const ControlPlaneContext = createContext<ControlPlaneClient | undefined>(
  undefined,
);

export function ControlPlaneProvider({
  client,
  children,
}: {
  client: ControlPlaneClient;
  children: ReactNode;
}) {
  return (
    <ControlPlaneContext.Provider value={client}>
      {children}
    </ControlPlaneContext.Provider>
  );
}

export interface ControlPlaneState {
  snapshot: ControlPlaneSnapshot;
  submitWork: (input: SubmitWorkInput) => Promise<string>;
  commandRun: (runId: string, command: RunCommand) => Promise<void>;
}

export function useControlPlane(): ControlPlaneState {
  const client = useContext(ControlPlaneContext);
  if (!client) {
    throw new Error("useControlPlane must be used inside ControlPlaneProvider");
  }

  const snapshot = useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
    client.getSnapshot,
  );

  return {
    snapshot,
    submitWork: client.submitWork,
    commandRun: client.commandRun,
  };
}
