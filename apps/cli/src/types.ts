export type ControlKind = "pause" | "resume" | "cancel";

export interface RuntimeRequest {
  adapter: string;
  provider: string;
  model: string;
  reasoningLevel: string;
}

export interface SubmitRequest {
  submitKey: string;
  prompt: string;
  projectPath: string;
  requiredCapabilities: string[];
  runtime: RuntimeRequest;
}

export interface RunSummary {
  id: string;
  prompt: string;
  projectPath?: string;
  status: string;
  validationStatus: string;
  runtime?: RuntimeRequest;
  updatedAt: number;
  resultSummary?: string;
  failure?: string;
}

export interface RunDetails {
  run: RunSummary;
  milestones: Array<{
    kind: string;
    summary: string;
    createdAt: number;
  }>;
}

export interface HostSummary {
  id: string;
  displayName: string;
  status: string;
  capabilities: string[];
  activeAssignments: number;
  maxConcurrent: number;
  sessionExpiresAt: number;
}

export interface NightShiftClient {
  submit(input: SubmitRequest): Promise<{ created: boolean; runId: string }>;
  listRuns(limit?: number): Promise<RunSummary[]>;
  getRun(runId: string): Promise<RunDetails | null>;
  listHosts(): Promise<HostSummary[]>;
  requestControl(
    runId: string,
    kind: ControlKind,
    idempotencyKey: string,
  ): Promise<{ accepted: boolean; status: string }>;
}
