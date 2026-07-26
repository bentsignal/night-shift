export type RunStatus =
  | "queued"
  | "claimed"
  | "running"
  | "paused"
  | "canceling"
  | "canceled"
  | "failed"
  | "completed";

export type ReasoningLevel = "medium" | "high" | "xhigh";

export type MilestoneKind =
  | "queued"
  | "claimed"
  | "started"
  | "progress"
  | "paused"
  | "resumed"
  | "validation"
  | "completed"
  | "failed"
  | "canceled";

export interface Milestone {
  id: string;
  kind: MilestoneKind;
  label: string;
  detail: string;
  at: string;
}

export interface HostReference {
  id: string;
  name: string;
}

export interface Lease {
  generation: number;
  expiresAt: string;
}

export interface ValidationResult {
  command: string;
  passed: boolean;
  durationMs: number;
}

export interface Run {
  id: string;
  title: string;
  prompt: string;
  project: string;
  provider: string;
  model: string;
  reasoning: ReasoningLevel;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  host?: HostReference;
  lease?: Lease;
  validation?: ValidationResult;
  milestones: Milestone[];
}

export type HostHealth = "ready" | "busy" | "offline";

export interface Host {
  id: string;
  name: string;
  health: HostHealth;
  lastSeenAt: string;
  capabilities: string[];
}

export interface ControlPlaneSnapshot {
  authority: "connected" | "recovering" | "offline";
  hosts: Host[];
  runs: Run[];
}

export interface SubmitWorkInput {
  prompt: string;
  project: string;
  provider: string;
  model: string;
  reasoning: ReasoningLevel;
}

export type RunCommand =
  { type: "pause" } | { type: "resume" } | { type: "cancel" };

export interface ControlPlaneClient {
  getSnapshot: () => ControlPlaneSnapshot;
  subscribe: (listener: () => void) => () => void;
  submitWork: (input: SubmitWorkInput) => Promise<string>;
  commandRun: (runId: string, command: RunCommand) => Promise<void>;
}
