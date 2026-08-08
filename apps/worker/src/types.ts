export type RunDesiredState = "running" | "paused" | "canceled";

export type ReasoningLevel =
  "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface RuntimeSelection {
  adapter: string;
  provider: string;
  model: string;
  reasoning: ReasoningLevel;
}

export interface WorkerAssignment {
  runId: string;
  attemptId: string;
  generation: number;
  hostId: string;
  hostSessionId: string;
  prompt: string;
  projectPath: string;
  leaseExpiresAt: number;
  controlGeneration: number;
  selection: RuntimeSelection;
}

export interface HostRegistration {
  hostId: string;
  sessionId: string;
}

export interface HostCapabilities {
  platform: string;
  arch: string;
  maxConcurrent: number;
  providers: string[];
  runtimeAdapters: string[];
  adapterVersion: string;
}

export interface AuthorityReply {
  accepted: boolean;
  reason?: "stale_fence" | "lease_expired" | "invalid_state";
}

export interface LeaseReply extends AuthorityReply {
  leaseExpiresAt?: number;
  desiredState?: RunDesiredState;
  controlGeneration?: number;
}

export interface AttemptIdentity {
  runId: string;
  attemptId: string;
  generation: number;
  hostId: string;
  hostSessionId: string;
  controlGeneration: number;
}

export interface RuntimeInput {
  attemptId: string;
  prompt: string;
  projectPath: string;
  systemPrompt: string;
}

export interface RuntimeMilestone {
  kind: "progress" | "checkpoint";
  operationId: string;
  summary: string;
}

export interface RuntimeResult {
  summary: string;
}

export interface RuntimeAdapter {
  execute(
    input: RuntimeInput,
    selection: RuntimeSelection,
    signal: AbortSignal,
    emit: (milestone: RuntimeMilestone) => Promise<void>,
  ): Promise<RuntimeResult>;
}

export interface ValidationResult {
  name: string;
  status: "passed" | "failed";
  exitCode: number;
  durationMs: number;
  summary: string;
}

export interface Validator {
  validate(projectPath: string, signal: AbortSignal): Promise<ValidationResult>;
}

export interface WorkerAuthority {
  registerHost(input: {
    hostKey: string;
    sessionId: string;
    displayName: string;
    capabilities: HostCapabilities;
  }): Promise<HostRegistration>;

  claimNext(input: HostRegistration): Promise<WorkerAssignment | null>;

  renewLease(input: AttemptIdentity): Promise<LeaseReply>;

  startAttempt(
    input: AttemptIdentity & { operationId: string },
  ): Promise<AuthorityReply>;

  recordMilestone(
    input: AttemptIdentity & RuntimeMilestone,
  ): Promise<AuthorityReply>;

  publishValidation(
    input: AttemptIdentity & {
      operationId: string;
      validation: ValidationResult;
    },
  ): Promise<AuthorityReply>;

  pauseAttempt(
    input: AttemptIdentity & {
      operationId: string;
      controlGeneration: number;
      summary: string;
    },
  ): Promise<AuthorityReply>;

  cancelAttempt(
    input: AttemptIdentity & {
      operationId: string;
      controlGeneration: number;
      summary: string;
    },
  ): Promise<AuthorityReply>;

  failAttempt(
    input: AttemptIdentity & {
      operationId: string;
      code: string;
      message: string;
    },
  ): Promise<AuthorityReply>;

  completeAttempt(
    input: AttemptIdentity & {
      operationId: string;
      summary: string;
    },
  ): Promise<AuthorityReply>;
}
